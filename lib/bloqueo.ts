import "server-only";
import { sql } from "drizzle-orm";
import type { Tx } from "@/lib/db";

export type EstadoVariante = {
  stock: number;
  // Unidades apartadas por reservas activas (sin contar la reserva que se excluye)
  reservado: number;
  coste: number;
  precio: number;
  activo: boolean;
  nombre: string;
};

// Unidades apartadas por reservas activas: pendientes o confirmadas que aún no han caducado
export function reservadoSql(excluirReserva?: number | null) {
  return sql`coalesce((
    select sum(lr.cantidad) from lineas_reserva lr join reservas r on r.id = lr.reserva_id
    where lr.variante_id = v.id and r.estado in ('pendiente', 'confirmada') and r.caduca_en > now()
      ${excluirReserva ? sql`and r.id <> ${excluirReserva}` : sql``}
  ), 0)::int`;
}

// Bloquea las variantes (en orden, para evitar bloqueos cruzados) y devuelve stock, apartado y coste actuales.
// Ventas, compras, ajustes y reservas pasan por aquí, así que no pueden pisarse entre ellas.
export async function bloquearVariantes(tx: Tx, ids: number[], excluirReserva?: number | null) {
  const unicos = [...new Set(ids)].sort((a, b) => a - b);
  const mapa = new Map<number, EstadoVariante>();
  if (unicos.length === 0) return mapa;
  const lista = sql.join(unicos.map((i) => sql`${i}`), sql`, `);
  await tx.execute(sql`select id from variantes where id in (${lista}) order by id for update`);
  const rows = (await tx.execute(sql`
    select v.id, v.coste_medio as coste, v.precio_venta as precio, (v.activo and p.activo) as activo,
           ma.nombre || ' ' || p.modelo || ' · ' || s.nombre || ' · ' || v.nicotina_mg || ' mg' as nombre,
           coalesce((select sum(m.cantidad) from movimientos_stock m where m.variante_id = v.id), 0)::int as stock,
           ${reservadoSql(excluirReserva)} as reservado
    from variantes v
    join productos p on p.id = v.producto_id
    join marcas ma on ma.id = p.marca_id
    join sabores s on s.id = v.sabor_id
    where v.id in (${lista})
  `)) as unknown as { id: number; coste: string; precio: string; activo: boolean; nombre: string; stock: number; reservado: number }[];
  for (const r of rows) {
    mapa.set(r.id, {
      stock: r.stock,
      reservado: r.reservado,
      coste: Number(r.coste),
      precio: Number(r.precio),
      activo: r.activo,
      nombre: r.nombre,
    });
  }
  for (const id of unicos) if (!mapa.has(id)) throw new Error(`El producto #${id} no existe.`);
  return mapa;
}

// Coste medio ponderado al entrar unidades
export function costeTrasEntrada(stock: number, coste: number, cantidad: number, costeEntrada: number) {
  const base = Math.max(stock, 0);
  if (base + cantidad <= 0) return costeEntrada;
  return (base * coste + cantidad * costeEntrada) / (base + cantidad);
}
