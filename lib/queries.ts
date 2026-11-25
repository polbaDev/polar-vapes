import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { TZ } from "@/lib/constants";

// Las consultas de lectura van en SQL directo: son joins y sumas, más claro así.

async function filas<T>(q: ReturnType<typeof sql>): Promise<T[]> {
  const res = await db.execute(q);
  return res as unknown as T[];
}

const STOCK = sql`coalesce((select sum(m.cantidad) from movimientos_stock m where m.variante_id = v.id), 0)::int`;

// Lo devuelto de cada línea de venta: unidades, dinero devuelto y coste que se recupera
// (solo el de lo que vuelve al stock; lo defectuoso se queda como pérdida).
// Las devoluciones restan de la venta original en los informes; en la caja cuentan el día en que se hacen.
export const DEVUELTO_POR_LINEA = sql`(
  select ld.linea_venta_id, sum(ld.cantidad)::int as cantidad, sum(ld.importe) as importe,
         sum(case when d.vuelve_al_stock then ld.cantidad * ld.coste_unidad else 0 end) as coste
  from lineas_devolucion ld join devoluciones d on d.id = ld.devolucion_id
  group by ld.linea_venta_id
)`;

export type VarianteFila = {
  id: number;
  productoId: number;
  marca: string;
  modelo: string;
  tipo: string;
  sabor: string;
  categoria: string;
  nicotinaMg: number;
  codigoBarras: string | null;
  precioVenta: string;
  costeMedio: string;
  stockMinimo: number;
  activo: boolean;
  stock: number;
  imagenId: number | null;
  imagenPropiaId: number | null;
  imagenFuente: string | null;
  color: string | null;
  descripcionSabor: string | null;
};

export type FiltroInventario = {
  q?: string;
  marcaId?: number;
  tipo?: string;
  categoria?: string;
  soloBajo?: boolean;
  incluirInactivos?: boolean;
};

export async function listarVariantes(f: FiltroInventario = {}) {
  const conds = [sql`true`];
  if (!f.incluirInactivos) conds.push(sql`v.activo and p.activo`);
  if (f.marcaId) conds.push(sql`p.marca_id = ${f.marcaId}`);
  if (f.tipo) conds.push(sql`p.tipo = ${f.tipo}`);
  if (f.categoria) conds.push(sql`s.categoria = ${f.categoria}`);
  if (f.q) {
    const like = `%${f.q}%`;
    conds.push(
      sql`(ma.nombre ilike ${like} or p.modelo ilike ${like} or s.nombre ilike ${like} or v.codigo_barras = ${f.q})`,
    );
  }
  const rows = await filas<VarianteFila>(sql`
    select v.id, v.producto_id as "productoId", ma.nombre as marca, p.modelo, p.tipo,
           s.nombre as sabor, s.categoria, v.nicotina_mg as "nicotinaMg",
           v.codigo_barras as "codigoBarras", v.precio_venta as "precioVenta",
           v.coste_medio as "costeMedio", v.stock_minimo as "stockMinimo",
           (v.activo and p.activo) as activo, ${STOCK} as stock,
           coalesce(v.imagen_id, p.imagen_id) as "imagenId", v.imagen_id as "imagenPropiaId", v.imagen_fuente as "imagenFuente", coalesce(iv.color, ip.color) as color,
           s.descripcion as "descripcionSabor"
    from variantes v
    join productos p on p.id = v.producto_id
    join marcas ma on ma.id = p.marca_id
    join sabores s on s.id = v.sabor_id
    left join imagenes iv on iv.id = v.imagen_id
    left join imagenes ip on ip.id = p.imagen_id
    where ${sql.join(conds, sql` and `)}
    order by ma.nombre, p.modelo, s.nombre, v.nicotina_mg
  `);
  return f.soloBajo ? rows.filter((r) => r.stock <= r.stockMinimo) : rows;
}

export async function stockDeVariante(id: number) {
  const [r] = await filas<{ stock: number }>(
    sql`select coalesce(sum(cantidad),0)::int as stock from movimientos_stock where variante_id = ${id}`,
  );
  return r?.stock ?? 0;
}

export async function obtenerVariante(id: number) {
  const rows = await listarVariantes({ incluirInactivos: true });
  return rows.find((r) => r.id === id) ?? null;
}

// ---------- Inicio ----------

export async function resumenPeriodo(dias: number) {
  // dias = 1 → hoy; 7 → últimos 7 días (incluido hoy); etc.
  const [r] = await filas<{
    ventas: number;
    total: string;
    unidades: number;
    coste: string;
  }>(sql`
    with vs as (
      select id, total from ventas
      where not anulada
        and (fecha at time zone ${TZ})::date > (now() at time zone ${TZ})::date - ${dias}::int
    ),
    ls as (
      select l.cantidad - coalesce(dl.cantidad, 0) as unidades,
             l.cantidad * l.coste_unidad - coalesce(dl.coste, 0) as coste,
             coalesce(dl.importe, 0) as devuelto
      from lineas_venta l
      left join ${DEVUELTO_POR_LINEA} dl on dl.linea_venta_id = l.id
      where l.venta_id in (select id from vs)
    )
    select (select count(*) from vs)::int as ventas,
           coalesce((select sum(total) from vs), 0) - coalesce((select sum(devuelto) from ls), 0) as total,
           coalesce((select sum(unidades) from ls), 0)::int as unidades,
           coalesce((select sum(coste) from ls), 0) as coste
  `);
  const total = Number(r.total);
  const coste = Number(r.coste);
  return { ventas: r.ventas, total, unidades: r.unidades, beneficio: total - coste };
}

export async function topSabores(dias: number, limite = 5) {
  return filas<{ sabor: string; unidades: number; total: string }>(sql`
    select s.nombre as sabor, sum(l.cantidad - coalesce(dl.cantidad, 0))::int as unidades,
           sum(l.cantidad * l.precio_unidad - coalesce(dl.importe, 0)) as total
    from lineas_venta l
    join ventas ve on ve.id = l.venta_id and not ve.anulada
    join variantes v on v.id = l.variante_id
    join sabores s on s.id = v.sabor_id
    left join ${DEVUELTO_POR_LINEA} dl on dl.linea_venta_id = l.id
    where (ve.fecha at time zone ${TZ})::date > (now() at time zone ${TZ})::date - ${dias}::int
    group by s.nombre
    having sum(l.cantidad - coalesce(dl.cantidad, 0)) > 0
    order by unidades desc
    limit ${limite}
  `);
}

// ---------- Ventas ----------

export type VentaFila = {
  id: number;
  fecha: Date;
  metodoPago: string;
  subtotal: string;
  descuento: string;
  total: string;
  // Dinero devuelto en devoluciones parciales (total - devuelto = lo que queda cobrado)
  devuelto: string;
  // Coste de lo que se queda el cliente (más lo defectuoso devuelto, que es pérdida)
  coste: string;
  unidades: number;
  anulada: boolean;
  // Quién la cobró (null: antes de las cuentas) y quién se quedó el dinero (null: sin indicar)
  vendedorId: number | null;
  vendedor: string | null;
  recibe: string | null;
};

// usuario: solo las de esa persona (0 = las de antes de las cuentas, sin nadie)
export async function listarVentas(desde: string, hasta: string, incluirAnuladas = true, usuario?: number) {
  return filas<VentaFila>(sql`
    select ve.id, ve.fecha, ve.metodo_pago as "metodoPago", ve.subtotal, ve.descuento, ve.total, ve.anulada,
           ve.usuario_id as "vendedorId", u.nombre as vendedor, r.nombre as recibe,
           coalesce(sum(dl.importe), 0) as devuelto,
           coalesce(sum(l.cantidad * l.coste_unidad), 0) - coalesce(sum(dl.coste), 0) as coste,
           coalesce(sum(l.cantidad - coalesce(dl.cantidad, 0)), 0)::int as unidades
    from ventas ve
    left join usuarios u on u.id = ve.usuario_id
    left join usuarios r on r.id = ve.recibe_id
    left join lineas_venta l on l.venta_id = ve.id
    left join ${DEVUELTO_POR_LINEA} dl on dl.linea_venta_id = l.id
    where (ve.fecha at time zone ${TZ})::date between ${desde}::date and ${hasta}::date
      ${incluirAnuladas ? sql`` : sql`and not ve.anulada`}
      ${usuario === undefined ? sql`` : usuario === 0 ? sql`and ve.usuario_id is null` : sql`and ve.usuario_id = ${usuario}`}
    group by ve.id, u.nombre, r.nombre
    order by ve.fecha desc
  `);
}

export async function detalleVenta(id: number) {
  const [venta] = await filas<{
    id: number;
    fecha: Date;
    metodoPago: string;
    subtotal: string;
    descuento: string;
    total: string;
    mayorEdadVerificado: boolean;
    notas: string | null;
    anulada: boolean;
    anuladaEn: Date | null;
    vendedor: string | null;
    recibeId: number | null;
    recibe: string | null;
    anuladaPor: string | null;
  }>(sql`
    select ve.id, ve.fecha, ve.metodo_pago as "metodoPago", ve.subtotal, ve.descuento, ve.total,
           ve.mayor_edad_verificado as "mayorEdadVerificado", ve.notas, ve.anulada, ve.anulada_en as "anuladaEn",
           u.nombre as vendedor, ve.recibe_id as "recibeId", r.nombre as recibe, a.nombre as "anuladaPor"
    from ventas ve
    left join usuarios u on u.id = ve.usuario_id
    left join usuarios r on r.id = ve.recibe_id
    left join usuarios a on a.id = ve.anulada_por_id
    where ve.id = ${id}
  `);
  if (!venta) return null;
  const lineas = await filas<{
    id: number;
    varianteId: number;
    marca: string;
    modelo: string;
    sabor: string;
    nicotinaMg: number;
    cantidad: number;
    precioUnidad: string;
    costeUnidad: string;
    devueltas: number;
    importeDevuelto: string;
    costeDevuelto: string;
  }>(sql`
    select l.id, l.variante_id as "varianteId", ma.nombre as marca, p.modelo, s.nombre as sabor,
           v.nicotina_mg as "nicotinaMg", l.cantidad, l.precio_unidad as "precioUnidad", l.coste_unidad as "costeUnidad",
           coalesce(dl.cantidad, 0) as devueltas, coalesce(dl.importe, 0) as "importeDevuelto",
           coalesce(dl.coste, 0) as "costeDevuelto"
    from lineas_venta l
    join variantes v on v.id = l.variante_id
    join productos p on p.id = v.producto_id
    join marcas ma on ma.id = p.marca_id
    join sabores s on s.id = v.sabor_id
    left join ${DEVUELTO_POR_LINEA} dl on dl.linea_venta_id = l.id
    where l.venta_id = ${id}
    order by l.id
  `);
  const devoluciones = await filas<{
    id: number;
    fecha: Date;
    metodoPago: string;
    importe: string;
    vuelveAlStock: boolean;
    motivo: string | null;
    detalle: string;
    usuario: string | null;
    paga: string | null;
  }>(sql`
    select d.id, d.fecha, d.metodo_pago as "metodoPago", d.importe, d.vuelve_al_stock as "vuelveAlStock", d.motivo,
           string_agg(s.nombre || ' × ' || ld.cantidad, ', ' order by ld.id) as detalle,
           u.nombre as usuario, p.nombre as paga
    from devoluciones d
    join lineas_devolucion ld on ld.devolucion_id = d.id
    join variantes v on v.id = ld.variante_id
    join sabores s on s.id = v.sabor_id
    left join usuarios u on u.id = d.usuario_id
    left join usuarios p on p.id = d.paga_id
    where d.venta_id = ${id}
    group by d.id, u.nombre, p.nombre
    order by d.fecha, d.id
  `);
  return { ...venta, lineas, devoluciones };
}

// ---------- Compras ----------

export async function listarCompras(limite = 200) {
  return filas<{
    id: number;
    fecha: string;
    proveedor: string | null;
    numFactura: string | null;
    total: string;
    unidades: number;
    anulada: boolean;
    // Socio que la pagó (null: dinero de la tienda o antes de las cuentas)
    paga: string | null;
  }>(sql`
    select c.id, to_char(c.fecha, 'YYYY-MM-DD') as fecha, pr.nombre as proveedor, c.proveedor_id as "proveedorId", c.num_factura as "numFactura",
           c.total, c.anulada, coalesce(sum(l.cantidad), 0)::int as unidades, p.nombre as paga
    from compras c
    left join proveedores pr on pr.id = c.proveedor_id
    left join usuarios p on p.id = c.paga_id
    left join lineas_compra l on l.compra_id = c.id
    group by c.id, pr.nombre, p.nombre
    order by c.fecha desc, c.id desc
    limit ${limite}
  `);
}

export async function detalleCompra(id: number) {
  const [compra] = await filas<{
    id: number;
    fecha: string;
    proveedor: string | null;
    proveedorId: number | null;
    numFactura: string | null;
    gastosEnvio: string;
    total: string;
    notas: string | null;
    anulada: boolean;
    anuladaEn: Date | null;
    usuario: string | null;
    pagaId: number | null;
    paga: string | null;
    anuladaPor: string | null;
  }>(sql`
    select c.id, to_char(c.fecha, 'YYYY-MM-DD') as fecha, pr.nombre as proveedor, c.num_factura as "numFactura",
           c.gastos_envio as "gastosEnvio", c.total, c.notas, c.anulada, c.anulada_en as "anuladaEn",
           u.nombre as usuario, c.paga_id as "pagaId", p.nombre as paga, a.nombre as "anuladaPor"
    from compras c
    left join proveedores pr on pr.id = c.proveedor_id
    left join usuarios u on u.id = c.usuario_id
    left join usuarios p on p.id = c.paga_id
    left join usuarios a on a.id = c.anulada_por_id
    where c.id = ${id}
  `);
  if (!compra) return null;
  const lineas = await filas<{
    id: number;
    varianteId: number;
    marca: string;
    modelo: string;
    sabor: string;
    nicotinaMg: number;
    cantidad: number;
    costeUnidad: string;
    costeReal: string;
    lote: string | null;
  }>(sql`
    select l.id, l.variante_id as "varianteId", ma.nombre as marca, p.modelo, s.nombre as sabor,
           v.nicotina_mg as "nicotinaMg", l.cantidad, l.coste_unidad as "costeUnidad", l.coste_real as "costeReal", l.lote
    from lineas_compra l
    join variantes v on v.id = l.variante_id
    join productos p on p.id = v.producto_id
    join marcas ma on ma.id = p.marca_id
    join sabores s on s.id = v.sabor_id
    where l.compra_id = ${id}
    order by l.id
  `);
  return { ...compra, lineas };
}

// ---------- Movimientos ----------

export async function movimientosDeVariante(id: number) {
  return filas<{
    id: number;
    tipo: string;
    cantidad: number;
    motivo: string | null;
    compraId: number | null;
    ventaId: number | null;
    fecha: Date;
  }>(sql`
    select id, tipo, cantidad, motivo, compra_id as "compraId", venta_id as "ventaId", fecha
    from movimientos_stock where variante_id = ${id}
    order by fecha desc, id desc
  `);
}

// ---------- Catálogo ----------

export async function listarMarcas() {
  return filas<{ id: number; nombre: string; productos: number }>(sql`
    select ma.id, ma.nombre, count(p.id)::int as productos
    from marcas ma left join productos p on p.marca_id = ma.id
    group by ma.id order by ma.nombre
  `);
}

export async function listarSabores() {
  return filas<{ id: number; nombre: string; categoria: string; descripcion: string | null; variantes: number }>(sql`
    select s.id, s.nombre, s.categoria, s.descripcion, count(v.id)::int as variantes
    from sabores s left join variantes v on v.sabor_id = s.id
    group by s.id order by s.nombre
  `);
}

export async function listarProveedores() {
  return filas<{
    id: number;
    nombre: string;
    telefono: string | null;
    email: string | null;
    notas: string | null;
    compras: number;
  }>(sql`
    select pr.id, pr.nombre, pr.telefono, pr.email, pr.notas, count(c.id)::int as compras
    from proveedores pr left join compras c on c.proveedor_id = pr.id
    group by pr.id order by pr.nombre
  `);
}

export type ProductoFila = {
  id: number;
  marcaId: number;
  marca: string;
  modelo: string;
  tipo: string;
  caladas: number | null;
  ml: string | null;
  activo: boolean;
  variantes: number;
  stock: number;
  descripcion: string | null;
  caracteristicas: string | null;
  imagenId: number | null;
  imagenFuente: string | null;
  color: string | null;
};

export async function listarProductos() {
  return filas<ProductoFila>(sql`
    select p.id, p.marca_id as "marcaId", ma.nombre as marca, p.modelo, p.tipo, p.caladas, p.ml, p.activo,
           p.descripcion, p.caracteristicas, p.imagen_fuente as "imagenFuente",
           coalesce(p.imagen_id, (select v3.imagen_id from variantes v3 where v3.producto_id = p.id and v3.imagen_id is not null order by v3.id limit 1)) as "imagenId",
           i.color,
           count(v.id)::int as variantes,
           coalesce((select sum(m.cantidad) from movimientos_stock m join variantes v2 on v2.id = m.variante_id where v2.producto_id = p.id), 0)::int as stock
    from productos p
    join marcas ma on ma.id = p.marca_id
    left join imagenes i on i.id = p.imagen_id
    left join variantes v on v.producto_id = p.id
    group by p.id, ma.nombre, i.color
    order by ma.nombre, p.modelo
  `);
}

export async function obtenerProducto(id: number) {
  const rows = await listarProductos();
  return rows.find((p) => p.id === id) ?? null;
}

export async function variantesDeProducto(productoId: number) {
  const rows = await listarVariantes({ incluirInactivos: true });
  return rows.filter((r) => r.productoId === productoId);
}

// Unidades vendidas de cada variante en los últimos N días (sin contar lo devuelto). Para ordenar el TPV.
export async function unidadesVendidas(dias = 30) {
  const rows = await filas<{ varianteId: number; unidades: number }>(sql`
    select l.variante_id as "varianteId", sum(l.cantidad - coalesce(dl.cantidad, 0))::int as unidades
    from lineas_venta l
    join ventas ve on ve.id = l.venta_id and not ve.anulada
    left join ${DEVUELTO_POR_LINEA} dl on dl.linea_venta_id = l.id
    where ve.fecha > now() - make_interval(days => ${dias}::int)
    group by l.variante_id
  `);
  return new Map(rows.map((r) => [r.varianteId, r.unidades]));
}

// Unidades vendidas por sabor de un producto en los últimos N días
export async function ventasPorVariante(productoId: number, dias = 30) {
  const rows = await filas<{ varianteId: number; unidades: number; total: string; coste: string }>(sql`
    select l.variante_id as "varianteId", sum(l.cantidad - coalesce(dl.cantidad, 0))::int as unidades,
           sum(l.cantidad * l.precio_unidad - coalesce(dl.importe, 0)) as total,
           sum(l.cantidad * l.coste_unidad - coalesce(dl.coste, 0)) as coste
    from lineas_venta l
    join ventas ve on ve.id = l.venta_id and not ve.anulada
    join variantes v on v.id = l.variante_id
    left join ${DEVUELTO_POR_LINEA} dl on dl.linea_venta_id = l.id
    where v.producto_id = ${productoId}
      and (ve.fecha at time zone ${TZ})::date > (now() at time zone ${TZ})::date - ${dias}::int
    group by l.variante_id
  `);
  return new Map(rows.map((r) => [r.varianteId, r]));
}

// ¿Hay imágenes "buenas" pendientes de descargar para este producto?
export async function imagenesPendientes(productoId: number) {
  const [r] = await filas<{ n: number }>(sql`
    select (
      (select count(*) from productos p left join imagenes i on i.id = p.imagen_id
        where p.id = ${productoId} and p.imagen_fuente is not null and (i.id is null or i.origen is distinct from p.imagen_fuente))
      +
      (select count(*) from variantes v left join imagenes i on i.id = v.imagen_id
        where v.producto_id = ${productoId} and v.imagen_fuente is not null and (i.id is null or i.origen is distinct from v.imagen_fuente))
    )::int as n
  `);
  return r?.n ?? 0;
}
