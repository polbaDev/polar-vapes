import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { reservadoSql } from "@/lib/bloqueo";
import { nombreModelo } from "@/components/buscador";

async function filas<T>(q: SQL): Promise<T[]> {
  return (await db.execute(q)) as unknown as T[];
}

// Estado tal como se ve: una reserva activa cuya hora ya pasó está «caducada»
const ESTADO = sql`case when r.estado in ('pendiente', 'confirmada') and r.caduca_en <= now() then 'caducada' else r.estado end`;

export type EstadoReserva = "pendiente" | "confirmada" | "caducada" | "vendida" | "rechazada" | "cancelada";

export const ETIQUETA_ESTADO: Record<EstadoReserva, string> = {
  pendiente: "Por confirmar",
  confirmada: "Confirmada",
  caducada: "Caducada",
  vendida: "Vendida",
  rechazada: "Rechazada",
  cancelada: "Cancelada",
};

// Código que ve el cliente: R-XXXXXX
export function codigoVisible(codigo: string) {
  return `R-${codigo}`;
}

// Acepta «R-K7P2XM», «r-k7p2xm» o «K7P2XM»
export function limpiarCodigo(texto: string) {
  return texto.trim().toUpperCase().replace(/^R-?/, "").replace(/[^A-Z0-9]/g, "");
}

// ---------- Catálogo público ----------

export type ArticuloCatalogo = {
  id: number;
  productoId: number;
  marca: string;
  modelo: string;
  caladas: number | null;
  descripcionProducto: string | null;
  sabor: string;
  descripcionSabor: string | null;
  nicotinaMg: number;
  precio: number;
  imagenId: number | null;
  color: string | null;
  nivel: "disponible" | "pocas" | "agotado";
  // Lo máximo que se deja reservar de este sabor (no se enseña el stock)
  maximo: number;
};

export async function catalogoPublico(maxUnidades: number): Promise<ArticuloCatalogo[]> {
  const rows = await filas<{
    id: number;
    productoId: number;
    marca: string;
    modelo: string;
    caladas: number | null;
    descripcionProducto: string | null;
    sabor: string;
    descripcionSabor: string | null;
    nicotinaMg: number;
    precio: string;
    imagenId: number | null;
    color: string | null;
    disponible: number;
    minimo: number;
  }>(sql`
    select v.id, v.producto_id as "productoId", ma.nombre as marca, p.modelo, p.caladas,
           p.descripcion as "descripcionProducto", s.nombre as sabor, s.descripcion as "descripcionSabor",
           v.nicotina_mg as "nicotinaMg", v.precio_venta as precio,
           coalesce(v.imagen_id, p.imagen_id) as "imagenId", coalesce(iv.color, ip.color) as color,
           greatest(coalesce((select sum(m.cantidad) from movimientos_stock m where m.variante_id = v.id), 0) - ${reservadoSql()}, 0)::int as disponible,
           v.stock_minimo as minimo
    from variantes v
    join productos p on p.id = v.producto_id
    join marcas ma on ma.id = p.marca_id
    join sabores s on s.id = v.sabor_id
    left join imagenes iv on iv.id = v.imagen_id
    left join imagenes ip on ip.id = p.imagen_id
    where v.activo and p.activo and v.precio_venta > 0
    order by ma.nombre, p.modelo, v.nicotina_mg, s.nombre
  `);
  return rows.map(({ disponible, minimo, precio, ...r }) => ({
    ...r,
    precio: Number(precio),
    nivel: disponible <= 0 ? "agotado" : disponible <= Math.max(3, minimo) ? "pocas" : "disponible",
    maximo: Math.min(disponible, maxUnidades),
  }));
}

// ---------- Reservas ----------

export type LineaReservaFila = {
  id: number;
  varianteId: number;
  marca: string;
  modelo: string;
  sabor: string;
  nicotinaMg: number;
  cantidad: number;
  precioUnidad: string;
};

export type ReservaFila = {
  id: number;
  codigo: string;
  nombre: string;
  estado: EstadoReserva;
  creadaEn: Date;
  caducaEn: Date;
  confirmadaEn: Date | null;
  cerradaEn: Date | null;
  ventaId: number | null;
  notas: string | null;
  unidades: number;
  total: string;
  resumen: string;
};

const COLUMNAS = sql`
  r.id, r.codigo, r.nombre, ${ESTADO} as estado, r.creada_en as "creadaEn", r.caduca_en as "caducaEn",
  r.confirmada_en as "confirmadaEn", r.cerrada_en as "cerradaEn", r.venta_id as "ventaId", r.notas,
  coalesce((select sum(lr.cantidad) from lineas_reserva lr where lr.reserva_id = r.id), 0)::int as unidades,
  coalesce((select sum(lr.cantidad * lr.precio_unidad) from lineas_reserva lr where lr.reserva_id = r.id), 0) as total,
  coalesce((select string_agg(lr.cantidad || '× ' || s.nombre, ', ' order by lr.id)
            from lineas_reserva lr join variantes v on v.id = lr.variante_id join sabores s on s.id = v.sabor_id
            where lr.reserva_id = r.id), '') as resumen
`;

async function lineasDe(reservaId: number) {
  return filas<LineaReservaFila>(sql`
    select lr.id, lr.variante_id as "varianteId", ma.nombre as marca, p.modelo, s.nombre as sabor,
           v.nicotina_mg as "nicotinaMg", lr.cantidad, lr.precio_unidad as "precioUnidad"
    from lineas_reserva lr
    join variantes v on v.id = lr.variante_id
    join productos p on p.id = v.producto_id
    join marcas ma on ma.id = p.marca_id
    join sabores s on s.id = v.sabor_id
    where lr.reserva_id = ${reservaId}
    order by lr.id
  `);
}

export async function reservaPorCodigo(codigo: string) {
  const c = limpiarCodigo(codigo);
  if (!c) return null;
  const [r] = await filas<ReservaFila>(sql`select ${COLUMNAS} from reservas r where r.codigo = ${c}`);
  if (!r) return null;
  return { ...r, lineas: await lineasDe(r.id) };
}

export async function detalleReserva(id: number) {
  const [r] = await filas<ReservaFila>(sql`select ${COLUMNAS} from reservas r where r.id = ${id}`);
  if (!r) return null;
  return { ...r, lineas: await lineasDe(r.id) };
}

export async function listarReservas() {
  return filas<ReservaFila>(sql`
    select ${COLUMNAS} from reservas r
    where r.estado in ('pendiente', 'confirmada') or r.creada_en > now() - interval '30 days'
    order by
      case ${ESTADO} when 'pendiente' then 0 when 'confirmada' then 1 when 'caducada' then 2 else 3 end,
      case when ${ESTADO} in ('pendiente', 'confirmada') then r.caduca_en end asc,
      r.creada_en desc
    limit 200
  `);
}

export async function contarPendientes() {
  const [r] = await filas<{ n: number }>(
    sql`select count(*)::int as n from reservas where estado = 'pendiente' and caduca_en > now()`,
  );
  return r?.n ?? 0;
}

// Unidades apartadas por variante (para el TPV), sin contar una reserva concreta si se indica
export async function unidadesReservadas(excluirReserva?: number | null) {
  const rows = await filas<{ varianteId: number; unidades: number }>(sql`
    select lr.variante_id as "varianteId", sum(lr.cantidad)::int as unidades
    from lineas_reserva lr join reservas r on r.id = lr.reserva_id
    where r.estado in ('pendiente', 'confirmada') and r.caduca_en > now()
      ${excluirReserva ? sql`and r.id <> ${excluirReserva}` : sql``}
    group by lr.variante_id
  `);
  return new Map(rows.map((r) => [r.varianteId, r.unidades]));
}

// «quedan 1 h 20 min» / «caducó hace 10 min»
export function tiempoRestante(hasta: Date | string, ahora = new Date()) {
  const ms = new Date(hasta).getTime() - ahora.getTime();
  const min = Math.round(Math.abs(ms) / 60000);
  const texto = min < 60 ? `${min} min` : min < 60 * 48 ? `${Math.floor(min / 60)} h ${min % 60 ? `${min % 60} min` : ""}`.trim() : `${Math.round(min / 1440)} días`;
  return ms > 0 ? `quedan ${texto}` : `caducó hace ${texto}`;
}

// Mensaje para WhatsApp que el cliente te envía
export function mensajeWhatsApp(r: { codigo: string; nombre: string; lineas: LineaReservaFila[] }) {
  const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
  const total = r.lineas.reduce((s, l) => s + l.cantidad * Number(l.precioUnidad), 0);
  const lineas = r.lineas.map((l) => `- ${l.cantidad} × ${l.sabor} (${nombreModelo(l)} · ${l.nicotinaMg} mg)`);
  return [
    "Hola, he hecho una reserva en el catálogo.",
    `Código: ${codigoVisible(r.codigo)}`,
    `Nombre: ${r.nombre}`,
    "",
    ...lineas,
    "",
    `Total: ${eur.format(total)}`,
  ].join("\n");
}
