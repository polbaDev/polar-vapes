import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { TZ } from "@/lib/constants";
import { redondear } from "@/lib/format";

// Cuentas de la caja. Un periodo va desde el último cierre (o desde el inicio del día, si nunca se ha cerrado)
// hasta que se cierra. Las ventas cuentan por su hora, y las anulaciones por la hora en que se anularon:
// si anulas hoy una venta en efectivo de ayer, el dinero sale del cajón hoy.

type Ejecutor = { execute: (q: SQL) => Promise<unknown> };

async function filas<T>(ej: Ejecutor, q: SQL): Promise<T[]> {
  return (await ej.execute(q)) as unknown as T[];
}

// Instante como parámetro de SQL (el driver necesita texto, no Date). null = sin límite.
function instante(d: Date | null) {
  return d ? sql`${d.toISOString()}::timestamptz` : sql`'infinity'::timestamptz`;
}

export type PeriodoCaja = {
  // Último cierre (null si es la primera vez)
  ultimoId: number | null;
  desde: Date;
  // Efectivo con el que empezó el periodo (null si nunca se ha cerrado: hay que preguntarlo)
  fondoInicial: number | null;
};

export async function periodoAbierto(ej: Ejecutor = db): Promise<PeriodoCaja> {
  const [ultimo] = await filas<{ id: number; hasta: Date; fondo: string }>(
    ej,
    sql`select id, hasta, fondo_siguiente as fondo from cierres_caja order by hasta desc, id desc limit 1`,
  );
  if (ultimo) return { ultimoId: ultimo.id, desde: new Date(ultimo.hasta), fondoInicial: Number(ultimo.fondo) };
  const [hoy] = await filas<{ inicio: Date }>(
    ej,
    sql`select (date_trunc('day', now() at time zone ${TZ}) at time zone ${TZ}) as inicio`,
  );
  return { ultimoId: null, desde: new Date(hoy.inicio), fondoInicial: null };
}

export type CuentasCaja = {
  ventasEfectivo: number;
  devolucionesEfectivo: number;
  entradas: number;
  salidas: number;
  ventasTarjeta: number;
  ventasBizum: number;
  tickets: number;
};

// hasta = null → hasta ahora mismo (periodo abierto)
export async function cuentasCaja(ej: Ejecutor, desde: Date, hasta: Date | null): Promise<CuentasCaja> {
  const fin = instante(hasta);
  const ini = instante(desde);
  const vendida = sql`(fecha > ${ini} and fecha <= ${fin})`;
  const anulada = sql`(anulada and anulada_en > ${ini} and anulada_en <= ${fin})`;
  const [v] = await filas<{
    efectivo: string;
    devoluciones: string;
    tarjeta: string;
    bizum: string;
    tickets: number;
  }>(
    ej,
    sql`
      select
        coalesce(sum(total) filter (where metodo_pago = 'efectivo' and ${vendida}), 0) as efectivo,
        coalesce(sum(total) filter (where metodo_pago = 'efectivo' and ${anulada}), 0) as devoluciones,
        coalesce(sum(total) filter (where metodo_pago = 'tarjeta' and ${vendida}), 0)
          - coalesce(sum(total) filter (where metodo_pago = 'tarjeta' and ${anulada}), 0) as tarjeta,
        coalesce(sum(total) filter (where metodo_pago = 'bizum' and ${vendida}), 0)
          - coalesce(sum(total) filter (where metodo_pago = 'bizum' and ${anulada}), 0) as bizum,
        count(*) filter (where ${vendida} and not anulada)::int as tickets
      from ventas
      where ${vendida} or ${anulada}
    `,
  );
  const [m] = await filas<{ entradas: string; salidas: string }>(
    ej,
    sql`
      select coalesce(sum(importe) filter (where tipo = 'entrada'), 0) as entradas,
             coalesce(sum(importe) filter (where tipo = 'salida'), 0) as salidas
      from movimientos_caja
      where fecha > ${ini} and fecha <= ${fin}
    `,
  );
  // Devoluciones parciales: el dinero sale el día en que se devuelve, por el medio que se elija
  const [d] = await filas<{ efectivo: string; tarjeta: string; bizum: string }>(
    ej,
    sql`
      select coalesce(sum(importe) filter (where metodo_pago = 'efectivo'), 0) as efectivo,
             coalesce(sum(importe) filter (where metodo_pago = 'tarjeta'), 0) as tarjeta,
             coalesce(sum(importe) filter (where metodo_pago = 'bizum'), 0) as bizum
      from devoluciones
      where fecha > ${ini} and fecha <= ${fin}
    `,
  );
  return {
    ventasEfectivo: Number(v.efectivo),
    devolucionesEfectivo: Number(v.devoluciones) + Number(d.efectivo),
    entradas: Number(m.entradas),
    salidas: Number(m.salidas),
    ventasTarjeta: Number(v.tarjeta) - Number(d.tarjeta),
    ventasBizum: Number(v.bizum) - Number(d.bizum),
    tickets: v.tickets,
  };
}

export function efectivoEsperado(fondo: number, c: CuentasCaja) {
  return redondear(fondo + c.ventasEfectivo - c.devolucionesEfectivo + c.entradas - c.salidas);
}

export type MovimientoCaja = { id: number; fecha: Date; tipo: "entrada" | "salida"; importe: string; motivo: string };

export async function movimientosCaja(desde: Date, hasta: Date | null) {
  return filas<MovimientoCaja>(
    db,
    sql`
      select id, fecha, tipo, importe, motivo from movimientos_caja
      where fecha > ${instante(desde)} and fecha <= ${instante(hasta)}
      order by fecha, id
    `,
  );
}

// Para la pantalla de caja y el aviso de Inicio
export async function estadoCaja() {
  const periodo = await periodoAbierto();
  const [cuentas, movimientos, [hoy]] = await Promise.all([
    cuentasCaja(db, periodo.desde, null),
    movimientosCaja(periodo.desde, null),
    filas<{ inicio: Date }>(db, sql`select (date_trunc('day', now() at time zone ${TZ}) at time zone ${TZ}) as inicio`),
  ]);
  const hayActividad = cuentas.tickets > 0 || cuentas.devolucionesEfectivo > 0 || movimientos.length > 0;
  return {
    periodo,
    cuentas,
    movimientos,
    esperado: periodo.fondoInicial === null ? null : efectivoEsperado(periodo.fondoInicial, cuentas),
    // Hay un periodo sin cerrar que viene de un día anterior
    pendienteDeOtroDia: periodo.ultimoId !== null && hayActividad && periodo.desde < new Date(hoy.inicio),
  };
}

export type CierreFila = {
  id: number;
  desde: Date;
  hasta: Date;
  fondoInicial: string;
  ventasEfectivo: string;
  devolucionesEfectivo: string;
  entradas: string;
  salidas: string;
  esperado: string;
  contado: string;
  descuadre: string;
  fondoSiguiente: string;
  ventasTarjeta: string;
  ventasBizum: string;
  tickets: number;
  notas: string | null;
};

const COLUMNAS_CIERRE = sql`
  id, desde, hasta, fondo_inicial as "fondoInicial", ventas_efectivo as "ventasEfectivo",
  devoluciones_efectivo as "devolucionesEfectivo", entradas, salidas, esperado, contado, descuadre,
  fondo_siguiente as "fondoSiguiente", ventas_tarjeta as "ventasTarjeta", ventas_bizum as "ventasBizum",
  tickets, notas
`;

export async function listarCierres(limite = 60) {
  return filas<CierreFila>(db, sql`select ${COLUMNAS_CIERRE} from cierres_caja order by hasta desc, id desc limit ${limite}`);
}

export async function detalleCierre(id: number) {
  const [c] = await filas<CierreFila>(db, sql`select ${COLUMNAS_CIERRE} from cierres_caja where id = ${id}`);
  if (!c) return null;
  const movimientos = await movimientosCaja(new Date(c.desde), new Date(c.hasta));
  return { ...c, movimientos };
}
