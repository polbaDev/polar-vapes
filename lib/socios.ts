import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { ajustes } from "@/lib/db/schema";
import { TZ } from "@/lib/constants";
import { DEVUELTO_POR_LINEA } from "@/lib/queries";
import type { SaldoSocio } from "@/lib/socios-calculo";

// Dinero de la tienda en manos de cada socio y ventas de cada persona.
// El saldo de un socio sube con lo que cobra (Bizum a su móvil, tarjeta a su cuenta), con lo que se lleva
// del cajón y con lo que le pasa otro socio; baja con lo que paga (compras, gastos, devoluciones), con lo
// que pone en el cajón, con lo que le pasa a otro y con lo que se queda como ganancia (reparto).
// El efectivo del cajón y la cuenta común son de todos: no cuentan hasta que alguien se lo lleva.

type Ejecutor = { execute: (q: SQL) => Promise<unknown> };

async function filas<T>(q: SQL, ej: Ejecutor = db): Promise<T[]> {
  return (await ej.execute(q)) as unknown as T[];
}

// Una fila por cada cosa que cambia el saldo de un socio, con el importe con signo
const MOVIMIENTOS_SALDO = sql`(
  select v.recibe_id as socio_id, case when v.metodo_pago = 'tarjeta' then 'tarjeta' else 'bizum' end as cat, v.total as importe
    from ventas v where not v.anulada and v.recibe_id is not null
  union all
  select d.paga_id, 'devoluciones', -d.importe from devoluciones d where d.paga_id is not null
  union all
  select c.paga_id, 'compras', -c.total from compras c where not c.anulada and c.paga_id is not null
  union all
  select m.socio_id, 'cajon', case when m.tipo = 'salida' then m.importe else -m.importe end
    from movimientos_caja m where m.socio_id is not null
  union all
  select c.recibe_id, 'cajon', c.contado - c.fondo_siguiente from cierres_caja c where c.recibe_id is not null
  union all
  select s.para_id, s.tipo, s.importe from movimientos_socios s where not s.anulado and s.para_id is not null
  union all
  select s.de_id, s.tipo, -s.importe from movimientos_socios s where not s.anulado and s.de_id is not null
)`;

export const CATEGORIAS_SALDO = ["bizum", "tarjeta", "cajon", "compras", "devoluciones", "gasto", "pago", "reparto", "ajuste"] as const;
export type CategoriaSaldo = (typeof CATEGORIAS_SALDO)[number];

export type SaldoDetallado = SaldoSocio & { socio: boolean; activo: boolean; desglose: Partial<Record<CategoriaSaldo, number>> };

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
    const s = porId.get(r.id) ?? { id: r.id, nombre: r.nombre, socio: r.socio, activo: r.activo, saldo: 0, desglose: {} };
    if (r.cat) {
      const n = Number(r.importe);
      s.desglose[r.cat] = n;
      s.saldo = Math.round((s.saldo + n) * 100) / 100;
    }
    porId.set(r.id, s);
  }
  return [...porId.values()].filter((s) => (s.socio && s.activo) || Math.abs(s.saldo) >= 0.005);
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
      select m.fecha, 'caja_' || m.tipo, m.id, m.motivo, m.socio_id, null,
             case when m.tipo = 'salida' then m.importe else -m.importe end, false
        from movimientos_caja m where m.socio_id is not null
      union all
      select c.hasta, 'cierre', c.id, null, c.recibe_id, null, c.contado - c.fondo_siguiente, false
        from cierres_caja c where c.recibe_id is not null and c.contado > c.fondo_siguiente
      union all
      select s.fecha, s.tipo, s.id, s.motivo, coalesce(s.de_id, s.para_id),
             case when s.de_id is not null then s.para_id end,
             case when s.de_id is not null then -s.importe else s.importe end, s.anulado
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

// ---------- A quién le llega el dinero de la tarjeta ----------

const CLAVE_TARJETA = "tarjeta_recibe";

// Socio al que le llega lo cobrado con tarjeta (null: a la cuenta de la tienda, que es de todos)
export async function tarjetaRecibe(ej: Ejecutor = db): Promise<number | null> {
  const [r] = await filas<{ id: number | null }>(
    sql`
      select u.id from ajustes a join usuarios u on a.valor ~ '^[0-9]{1,9}$' and u.id = a.valor::int and u.socio and u.activo
      where a.clave = ${CLAVE_TARJETA}
    `,
    ej,
  );
  return r?.id ?? null;
}

export async function guardarTarjetaRecibe(id: number | null) {
  const valor = id ? String(id) : "";
  await db.insert(ajustes).values({ clave: CLAVE_TARJETA, valor }).onConflictDoUpdate({ target: ajustes.clave, set: { valor } });
}

// ¿Es un socio activo? (los únicos que pueden tener dinero de la tienda)
export async function esSocioActivo(id: number, ej: Ejecutor = db) {
  const [r] = await filas<{ ok: boolean }>(sql`select exists (select 1 from usuarios where id = ${id} and socio and activo) as ok`, ej);
  return r.ok;
}
