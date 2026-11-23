import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { calcularPedido } from "@/lib/pedido-calculo";

export type OpcionesPedido = {
  // Días de ventas que se miran para calcular el ritmo
  ventana: number;
  // Para cuántos días quieres tener stock
  cobertura: number;
  // Redondear a cajas de N unidades
  multiplo: number;
  marcaId?: number;
  // Solo lo que compraste por última vez a este proveedor
  proveedorId?: number;
};

export type LineaPedido = {
  varianteId: number;
  productoId: number;
  marca: string;
  modelo: string;
  sabor: string;
  nicotinaMg: number;
  stock: number;
  minimo: number;
  vendidas: number;
  // unidades por semana, para mostrar
  porSemana: number;
  diasRestantes: number | null;
  sugerido: number;
  // Coste por unidad estimado: el de la última factura, o el coste medio
  coste: number | null;
  proveedor: string | null;
  imagenId: number | null;
  color: string | null;
};

export async function calcularPedidoSugerido(o: OpcionesPedido): Promise<LineaPedido[]> {
  const filtros = [sql`v.activo and p.activo`];
  if (o.marcaId) filtros.push(sql`p.marca_id = ${o.marcaId}`);
  if (o.proveedorId) filtros.push(sql`uc.proveedor_id = ${o.proveedorId}`);

  const filas = (await db.execute(sql`
    with vendidas as (
      select l.variante_id, sum(l.cantidad)::int as unidades
      from lineas_venta l
      join ventas ve on ve.id = l.venta_id and not ve.anulada
      where ve.fecha > now() - make_interval(days => ${o.ventana}::int)
      group by l.variante_id
    ),
    stock as (
      select variante_id, sum(cantidad)::int as unidades, min(fecha) as primera
      from movimientos_stock
      group by variante_id
    ),
    ultima_compra as (
      select distinct on (l.variante_id) l.variante_id, c.proveedor_id, l.coste_unidad
      from lineas_compra l
      join compras c on c.id = l.compra_id and not c.anulada
      order by l.variante_id, c.fecha desc, c.id desc
    )
    select v.id as "varianteId", v.producto_id as "productoId", ma.nombre as marca, p.modelo,
           s.nombre as sabor, v.nicotina_mg as "nicotinaMg", v.stock_minimo as minimo,
           coalesce(st.unidades, 0) as stock, coalesce(ve.unidades, 0) as vendidas,
           -- Días con historial: desde que entró en stock por primera vez, como mucho la ventana
           greatest(1, least(${o.ventana}::numeric, extract(epoch from now() - st.primera) / 86400))::float8 as "diasHistorial",
           coalesce(nullif(uc.coste_unidad, 0), nullif(v.coste_medio, 0)) as coste,
           pr.nombre as proveedor,
           coalesce(v.imagen_id, p.imagen_id) as "imagenId", coalesce(iv.color, ip.color) as color
    from variantes v
    join productos p on p.id = v.producto_id
    join marcas ma on ma.id = p.marca_id
    join sabores s on s.id = v.sabor_id
    left join vendidas ve on ve.variante_id = v.id
    left join stock st on st.variante_id = v.id
    left join ultima_compra uc on uc.variante_id = v.id
    left join proveedores pr on pr.id = uc.proveedor_id
    left join imagenes iv on iv.id = v.imagen_id
    left join imagenes ip on ip.id = p.imagen_id
    where ${sql.join(filtros, sql` and `)}
    order by ma.nombre, p.modelo, v.nicotina_mg, s.nombre
  `)) as unknown as (Omit<LineaPedido, "porSemana" | "diasRestantes" | "sugerido" | "coste"> & {
    diasHistorial: number;
    coste: string | null;
  })[];

  return filas.map((f) => {
    const r = calcularPedido({
      stock: f.stock,
      minimo: f.minimo,
      vendidas: f.vendidas,
      diasHistorial: Number(f.diasHistorial),
      diasCobertura: o.cobertura,
      multiplo: o.multiplo,
    });
    const { diasHistorial: _, ...resto } = f;
    return {
      ...resto,
      coste: f.coste === null ? null : Number(f.coste),
      porSemana: r.ritmo * 7,
      diasRestantes: r.diasRestantes,
      sugerido: r.sugerido,
    };
  });
}
