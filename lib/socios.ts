import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { TZ } from "@/lib/constants";
import { DEVUELTO_POR_LINEA } from "@/lib/queries";
import type { SaldoSocio } from "@/lib/socios-calculo";

// Dinero de la tienda en manos de cada socio y ventas de cada persona. No hay caja ni cuenta común: el
// dinero de la tienda (el bote) siempre lo tiene alguno de los socios.
//  - Lo que tiene del bote sube con lo que cobra (efectivo que se queda, Bizum a su móvil, tarjeta a su
//    cuenta), con las aportaciones que guarda y con lo que le pasa el otro; baja con lo que paga (compras,
//    gastos, devoluciones), con lo que le pasa al otro y con lo que se queda como ganancia (reparto).
//  - Lo que ha puesto de su bolsillo son sus aportaciones al bote.
//  - Su saldo (lo que tiene menos lo que ha puesto) es lo que sirve para saber quién paga a quién.

type Ejecutor = { execute: (q: SQL) => Promise<unknown> };

async function filas<T>(q: SQL, ej: Ejecutor = db): Promise<T[]> {
  return (await ej.execute(q)) as unknown as T[];
}

// Una fila por cada cosa que cambia el saldo de un socio, con el importe con signo
const MOVIMIENTOS_SALDO = sql`(
  select v.recibe_id as socio_id, v.metodo_pago as cat, v.total as importe
    from ventas v where not v.anulada and v.recibe_id is not null
  union all
  select d.paga_id, 'devoluciones', -d.importe from devoluciones d where d.paga_id is not null
  union all
  select c.paga_id, 'compras', -c.total from compras c where not c.anulada and c.paga_id is not null

  union all
  select s.para_id, s.tipo, s.importe from movimientos_socios s where not s.anulado and s.para_id is not null
  union all
  select s.de_id, case when s.tipo = 'aportacion' then 'aportado' else s.tipo end, -s.importe
    from movimientos_socios s where not s.anulado and s.de_id is not null
)`;

// Lo que suma o resta de lo que tiene cada uno del bote (las aportaciones que pone van aparte: «aportado»)
export const CATEGORIAS_SALDO = [
  "efectivo",
  "bizum",
  "tarjeta",
  "aportacion",
  "compras",
  "devoluciones",
  "gasto",
  "pago",
  "reparto",
  "ajuste",
] as const;
export type CategoriaSaldo = (typeof CATEGORIAS_SALDO)[number] | "aportado";

// saldo = tiene − aportado
export type SaldoDetallado = SaldoSocio & {
  socio: boolean;
  activo: boolean;
  // Dinero del bote que tiene (negativo: ha adelantado dinero suyo que aún no ha recuperado)
  tiene: number;
  // Lo que ha puesto de su bolsillo en el bote (aportaciones)
  aportado: number;
  desglose: Partial<Record<CategoriaSaldo, number>>;
};

// Saldo de los socios activos y de cualquier cuenta que aún tenga dinero de la tienda
export async function saldosSocios(): Promise<SaldoDetallado[]> {
  const rows = await filas<{ id: number; nombre: string; socio: boolean; activo: boolean; cat: CategoriaSaldo | null; importe: string | null }>(sql`
    select u.id, u.nombre, u.socio, u.activo, m.cat, sum(m.importe) as importe
    from usuarios u
    left join ${MOVIMIENTOS_SALDO} m on m.socio_id = u.id
    group by u.id, m.cat
    order by u.id
  `);
  const porId = new Map<number, SaldoDetallado>();
  for (const r of rows) {
    const s = porId.get(r.id) ?? { id: r.id, nombre: r.nombre, socio: r.socio, activo: r.activo, saldo: 0, tiene: 0, aportado: 0, desglose: {} };
    if (r.cat) {
      const n = Number(r.importe);
      s.desglose[r.cat] = n;
      s.saldo = Math.round((s.saldo + n) * 100) / 100;
      if (r.cat === "aportado") s.aportado = Math.round((s.aportado - n) * 100) / 100;
      else s.tiene = Math.round((s.tiene + n) * 100) / 100;
    }
    porId.set(r.id, s);
  }
  return [...porId.values()].filter((s) => (s.socio && s.activo) || Math.abs(s.saldo) >= 0.005 || Math.abs(s.tiene) >= 0.005);
}

export type MovimientoDinero = {
  fecha: Date;
  tipo: string;
  ref: number;
  detalle: string | null;
  socioId: number;
  socio: string;
  otroId: number | null;
  otro: string | null;
  importe: string;
  anulado: boolean;
};

// Últimos movimientos que cambian el saldo de algún socio (un pago entre socios sale en una sola fila)
export async function movimientosDinero(limite = 60) {
  return filas<MovimientoDinero>(sql`
    select x.fecha, x.tipo, x.ref, x.detalle, x.socio_id as "socioId", u.nombre as socio,
           x.otro_id as "otroId", o.nombre as otro, x.importe, x.anulado
    from (
      select v.fecha, 'venta' as tipo, v.id as ref, v.metodo_pago as detalle, v.recibe_id as socio_id,
             null::int as otro_id, v.total as importe, false as anulado
        from ventas v where not v.anulada and v.recibe_id is not null
      union all
      select d.fecha, 'devolucion', d.venta_id, d.metodo_pago, d.paga_id, null, -d.importe, false
        from devoluciones d where d.paga_id is not null
      union all
      select ((c.fecha + time '12:00') at time zone ${TZ}), 'compra', c.id, pr.nombre, c.paga_id, null, -c.total, false
        from compras c left join proveedores pr on pr.id = c.proveedor_id
        where not c.anulada and c.paga_id is not null

      union all
      select s.fecha, s.tipo, s.id, s.motivo, coalesce(s.de_id, s.para_id),
             case when s.de_id is not null and s.para_id is distinct from s.de_id then s.para_id end,
             case when s.de_id is not null and s.tipo <> 'aportacion' then -s.importe else s.importe end, s.anulado
        from movimientos_socios s
    ) x
    join usuarios u on u.id = x.socio_id
    left join usuarios o on o.id = x.otro_id
    order by x.fecha desc, x.tipo, x.ref desc
    limit ${limite}
  `);
}

export type VentasPersona = {
  usuarioId: number | null;
  nombre: string | null;
  tickets: number;
  unidades: number;
  vendido: string;
  beneficio: string;
};

// Lo que ha vendido cada persona entre dos días (incluidos), descontando devoluciones
export async function ventasPorPersona(desde: string, hasta: string) {
  return filas<VentasPersona>(sql`
    with vs as (
      select ve.id, ve.usuario_id, ve.total,
             coalesce(sum(dl.importe), 0) as devuelto,
             coalesce(sum(l.cantidad * l.coste_unidad), 0) - coalesce(sum(dl.coste), 0) as coste,
             coalesce(sum(l.cantidad - coalesce(dl.cantidad, 0)), 0)::int as unidades
      from ventas ve
      left join lineas_venta l on l.venta_id = ve.id
      left join ${DEVUELTO_POR_LINEA} dl on dl.linea_venta_id = l.id
      where not ve.anulada and (ve.fecha at time zone ${TZ})::date between ${desde}::date and ${hasta}::date
      group by ve.id
    )
    select vs.usuario_id as "usuarioId", u.nombre, count(*)::int as tickets, sum(vs.unidades)::int as unidades,
           sum(vs.total - vs.devuelto) as vendido, sum(vs.total - vs.devuelto - vs.coste) as beneficio
    from vs left join usuarios u on u.id = vs.usuario_id
    group by vs.usuario_id, u.nombre
    order by vendido desc
  `);
}

// ¿Es un socio activo? (los únicos que pueden tener dinero de la tienda)
export async function esSocioActivo(id: number, ej: Ejecutor = db) {
  const [r] = await filas<{ ok: boolean }>(sql`select exists (select 1 from usuarios where id = ${id} and socio and activo) as ok`, ej);
  return r.ok;
}
