import Link from "next/link";
import { Cabecera, Vacio } from "@/components/ui";
import { FormAccion, BotonEnviar } from "@/components/form-accion";
import { FormMovimientoSocio } from "@/components/form-socios";
import { anularMovimientoSocio, apuntarMovimientoSocio } from "@/lib/actions/socios";
import { exigirSesion } from "@/lib/session";
import { CATEGORIAS_SALDO, movimientosDinero, saldosSocios, ventasPorPersona, type CategoriaSaldo, type MovimientoDinero } from "@/lib/socios";
import { pagosParaIgualar, proximaCompra } from "@/lib/socios-calculo";
import { listarSocios } from "@/lib/usuarios";
import { euros, fechaHora, hoyISO } from "@/lib/format";
import { tx, type T } from "@/lib/i18n";
import { traductor } from "@/lib/i18n/servidor";

export async function generateMetadata() {
  const t = await traductor();
  return { title: t("Socios") };
}

const PERIODOS = [
  { id: "hoy", texto: tx("Hoy") },
  { id: "7", texto: tx("7 días") },
  { id: "30", texto: tx("30 días") },
  { id: "mes", texto: tx("Este mes") },
];

const CATEGORIAS: Record<CategoriaSaldo, string> = {
  bizum: tx("Bizum que le llegaron"),
  tarjeta: tx("Tarjeta, a su cuenta"),
  cajon: tx("Efectivo del cajón (se llevó − puso)"),
  compras: tx("Compras que pagó"),
  devoluciones: tx("Devoluciones que pagó"),
  gasto: tx("Gastos que pagó"),
  pago: tx("Pagos entre socios"),
  reparto: tx("Ganancias que se quedó"),
  ajuste: tx("Saldo de partida"),
};

function restarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

function concepto(m: MovimientoDinero, t: T) {
  switch (m.tipo) {
    case "venta":
      return (
        <Link href={`/ventas/${m.ref}`} className="hover:underline">
          {m.detalle === "tarjeta" ? t("Venta #{id} con tarjeta", { id: m.ref }) : t("Venta #{id} por Bizum", { id: m.ref })}
        </Link>
      );
    case "devolucion":
      return (
        <Link href={`/ventas/${m.ref}`} className="hover:underline">
          {t("Devolución de la venta #{id}", { id: m.ref })}
        </Link>
      );
    case "compra":
      return (
        <Link href={`/compras/${m.ref}`} className="hover:underline">
          {t("Compra #{id}", { id: m.ref })}
          {m.detalle ? ` · ${m.detalle}` : ""}
        </Link>
      );
    case "caja_salida":
      return t("Se lleva del cajón: {motivo}", { motivo: m.detalle ?? "" });
    case "caja_entrada":
      return t("Pone en el cajón: {motivo}", { motivo: m.detalle ?? "" });
    case "cierre":
      return (
        <Link href={`/caja/${m.ref}`} className="hover:underline">
          {t("Se lleva el efectivo del cierre #{id}", { id: m.ref })}
        </Link>
      );
    case "pago":
      return m.detalle ? `${t("Pago entre socios")} · ${m.detalle}` : t("Pago entre socios");
    case "gasto":
      return t("Gasto: {concepto}", { concepto: m.detalle ?? "" });
    case "reparto":
      return m.detalle ? `${t("Reparto de ganancias")} · ${m.detalle}` : t("Reparto de ganancias");
    case "ajuste":
      return t("Saldo de partida: {concepto}", { concepto: m.detalle ?? "" });
    default:
      return m.tipo;
  }
}

export default async function Socios({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const t = await traductor();
  const sp = await searchParams;
  const hoy = hoyISO();
  const periodo = PERIODOS.some((p) => p.id === sp.p) ? sp.p! : "mes";
  const desde =
    periodo === "hoy" ? hoy : periodo === "7" ? restarDias(hoy, 6) : periodo === "30" ? restarDias(hoy, 29) : `${hoy.slice(0, 7)}-01`;

  const [yo, saldos, socios, movimientos, ventas] = await Promise.all([
    exigirSesion(),
    saldosSocios(),
    listarSocios(),
    movimientosDinero(),
    ventasPorPersona(desde, hoy),
  ]);
  // Entran en el reparto los socios (también uno desactivado al que aún le quede saldo)
  const delReparto = saldos.filter((s) => s.socio);
  const pagos = pagosParaIgualar(delReparto);
  const proxima = proximaCompra(delReparto);
  // Cuentas que no son de socio pero tienen dinero de la tienda (por ejemplo, alguien que dejó de ser socio)
  const fuera = saldos.filter((s) => !s.socio);
  const filas = CATEGORIAS_SALDO.filter((c) => saldos.some((s) => Math.abs(s.desglose[c] ?? 0) >= 0.005));
  const totalVendido = ventas.reduce((s, v) => s + Number(v.vendido), 0);
  const totalBeneficio = ventas.reduce((s, v) => s + Number(v.beneficio), 0);
  const totalTickets = ventas.reduce((s, v) => s + v.tickets, 0);
  const totalUnidades = ventas.reduce((s, v) => s + v.unidades, 0);
  const consulta = periodo === "mes" ? "p=mes" : `p=${periodo}`;

  return (
    <>
      <Cabecera
        titulo={t("Socios")}
        subtitulo={t("Quién tiene el dinero de la tienda, quién paga a quién y cuánto vende cada uno.")}
        acciones={
          <Link href="/socios/cuentas" className="btn-sec">
            {t("Cuentas y contraseñas")}
          </Link>
        }
      />

      {delReparto.length < 2 ? (
        <div className="tarjeta mb-6 border-marca-200 bg-marca-50 p-5 text-sm text-marca-900">
          <h2 className="font-semibold">{t("Falta la cuenta de tu socio")}</h2>
          <p className="mt-1">
            {t("Para llevar las cuentas entre los dos, cada uno necesita su cuenta.")}{" "}
            <Link href="/socios/cuentas" className="font-medium underline">
              {t("Crear la cuenta de tu socio")}
            </Link>
          </p>
        </div>
      ) : (
        <section className="tarjeta mb-6 overflow-hidden">
          <h2 className="border-b border-zinc-200 px-4 py-3 font-semibold">{t("Para quedar a la par")}</h2>
          <div className="space-y-3 px-4 py-4">
            {pagos.length === 0 ? (
              <p className="text-lg font-medium text-emerald-700">{t("Estáis a la par ✓")}</p>
            ) : (
              pagos.map((p) => (
                <FormAccion key={`${p.deId}-${p.paraId}`} accion={apuntarMovimientoSocio} className="flex flex-wrap items-center justify-between gap-3">
                  <input type="hidden" name="tipo" value="pago" />
                  <input type="hidden" name="de" value={p.deId} />
                  <input type="hidden" name="para" value={p.paraId} />
                  <input type="hidden" name="importe" value={p.importe.toFixed(2)} />
                  <input type="hidden" name="motivo" value={t("Para quedar a la par")} />
                  <p className="text-lg">
                    <strong>{p.de}</strong> {t("paga")} <strong className="tabular-nums">{euros(p.importe)}</strong> {t("a")} <strong>{p.para}</strong>
                  </p>
                  <BotonEnviar className="btn-sec" textoPendiente={t("Apuntando…")}>
                    {t("Ya está pagado: apuntarlo")}
                  </BotonEnviar>
                </FormAccion>
              ))
            )}
            {proxima && (
              <p className="text-sm text-zinc-600">
                {t("O sin pasaros dinero: la próxima compra le toca pagarla a {nombre}. Si es de {importe}, quedáis a la par.", {
                  nombre: proxima.nombre,
                  importe: euros(proxima.importe),
                })}
              </p>
            )}
          </div>
        </section>
      )}

      {saldos.length > 0 && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {saldos.map((s) => (
              <div key={s.id} className="tarjeta min-w-0 px-4 py-3.5 sm:px-5 sm:py-4">
                <div className="text-[.82rem] font-medium text-zinc-500">
                  {s.nombre}
                  {!s.socio && ` · ${t("no es socio")}`}
                </div>
                <div className="mt-1.5 text-[1.3rem] font-[550] leading-tight tracking-[-.025em] tabular-nums sm:text-[1.6rem]">{euros(s.saldo)}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {s.saldo >= 0 ? t("Dinero de la tienda que tiene") : t("Ha puesto de su bolsillo")}
                </div>
              </div>
            ))}
          </div>

          {filas.length > 0 && (
            <section className="tarjeta mb-6 overflow-x-auto">
              <h2 className="border-b border-zinc-200 px-4 py-3 font-semibold">{t("De dónde sale el saldo")}</h2>
              <table className="tabla">
                <thead>
                  <tr>
                    <th></th>
                    {saldos.map((s) => (
                      <th key={s.id} className="text-right">
                        {s.nombre}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((c) => (
                    <tr key={c}>
                      <td className="text-zinc-600">{t(CATEGORIAS[c])}</td>
                      {saldos.map((s) => (
                        <td key={s.id} className="text-right tabular-nums">
                          {s.desglose[c] ? euros(s.desglose[c]) : <span className="text-zinc-400">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td>{t("Saldo")}</td>
                    {saldos.map((s) => (
                      <td key={s.id} className="text-right tabular-nums">
                        {euros(s.saldo)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </section>
          )}
          {fuera.length > 0 && (
            <p className="-mt-3 mb-6 text-xs text-zinc-500">
              {t("Las cuentas que no son de socio no entran en el reparto: pasad su saldo a un socio con un pago entre socios.")}
            </p>
          )}
        </>
      )}

      <section className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{t("Lo que vende cada uno")}</h2>
          <div className="flex flex-wrap gap-2">
            {PERIODOS.map((p) => (
              <Link key={p.id} href={`/socios?p=${p.id}`} aria-current={periodo === p.id ? "true" : undefined} className="chip">
                {t(p.texto)}
              </Link>
            ))}
          </div>
        </div>
        {ventas.length === 0 ? (
          <Vacio>{t("No hay ventas en este periodo.")}</Vacio>
        ) : (
          <div className="tarjeta overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>{t("Persona")}</th>
                  <th className="text-right">{t("Tickets")}</th>
                  <th className="text-right">{t("Uds.")}</th>
                  <th className="text-right">{t("Vendido")}</th>
                  <th className="text-right">{t("Beneficio")}</th>
                  <th className="text-right">{t("Ticket medio")}</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((v) => (
                  <tr key={v.usuarioId ?? 0}>
                    <td>
                      <Link href={`/ventas?${consulta}&u=${v.usuarioId ?? 0}`} className="font-medium hover:underline">
                        {v.nombre ?? t("Sin asignar (antes de las cuentas)")}
                      </Link>
                    </td>
                    <td className="text-right tabular-nums">{v.tickets}</td>
                    <td className="text-right tabular-nums">{v.unidades}</td>
                    <td className="text-right font-medium tabular-nums">{euros(v.vendido)}</td>
                    <td className="text-right tabular-nums">{euros(v.beneficio)}</td>
                    <td className="text-right tabular-nums">{euros(v.tickets ? Number(v.vendido) / v.tickets : 0)}</td>
                  </tr>
                ))}
                {ventas.length > 1 && (
                  <tr className="font-semibold">
                    <td>{t("Total")}</td>
                    <td className="text-right tabular-nums">{totalTickets}</td>
                    <td className="text-right tabular-nums">{totalUnidades}</td>
                    <td className="text-right tabular-nums">{euros(totalVendido)}</td>
                    <td className="text-right tabular-nums">{euros(totalBeneficio)}</td>
                    <td className="text-right tabular-nums">{euros(totalTickets ? totalVendido / totalTickets : 0)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-zinc-500">
          {t("Es para saber cuánto vende cada uno: con el reparto al 50 %, el beneficio es de los dos venda quien venda.")}
        </p>
      </section>

      {socios.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 font-semibold">{t("Apuntar")}</h2>
          <FormMovimientoSocio socios={socios} yo={yo.id} />
        </section>
      )}

      <section className="mb-6">
        <h2 className="mb-3 font-semibold">{t("Últimos movimientos de dinero")}</h2>
        {movimientos.length === 0 ? (
          <Vacio>{t("Todavía no hay nada. Aquí saldrán los Bizum, lo que os llevéis del cajón, las compras que paguéis y los pagos entre vosotros.")}</Vacio>
        ) : (
          <div className="tarjeta overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>{t("Fecha")}</th>
                  <th>{t("Concepto")}</th>
                  <th>{t("Socio")}</th>
                  <th className="text-right">{t("Importe")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => {
                  const propio = ["pago", "gasto", "reparto", "ajuste"].includes(m.tipo);
                  return (
                    <tr key={`${m.tipo}-${m.ref}-${m.socioId}`} className={m.anulado ? "text-zinc-400 line-through" : ""}>
                      <td className="whitespace-nowrap text-xs text-zinc-500">{fechaHora(m.fecha)}</td>
                      <td>{concepto(m, t)}</td>
                      <td className="whitespace-nowrap">{m.otro ? `${m.socio} → ${m.otro}` : m.socio}</td>
                      <td className="whitespace-nowrap text-right font-medium tabular-nums">
                        {m.otro ? euros(Math.abs(Number(m.importe))) : `${Number(m.importe) >= 0 ? "+" : "−"}${euros(Math.abs(Number(m.importe)))}`}
                      </td>
                      <td className="w-px text-right no-underline">
                        {propio && !m.anulado && (
                          <FormAccion accion={anularMovimientoSocio}>
                            <input type="hidden" name="id" value={m.ref} />
                            <BotonEnviar className="text-sm text-zinc-400 hover:text-red-700" textoPendiente="…">
                              {t("Anular")}
                            </BotonEnviar>
                          </FormAccion>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="max-w-2xl rounded-xl border border-zinc-200 bg-superficie p-4 text-sm text-zinc-600">
        <h2 className="font-semibold text-zinc-900">{t("Cómo se calcula")}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>{t("El saldo de cada uno es el dinero de la tienda que tiene: lo que cobra o se lleva, menos lo que paga.")}</li>
          <li>{t("Suma: los Bizum que le llegan, la tarjeta si entra en su cuenta, el efectivo que se lleva del cajón y lo que le pasa el otro.")}</li>
          <li>{t("Resta: las compras y gastos que paga, las devoluciones que hace, lo que pone en el cajón, lo que le pasa al otro y las ganancias que se queda.")}</li>
          <li>{t("El efectivo del cajón es de los dos hasta que alguien se lo lleva (al cerrar caja o con una salida).")}</li>
          <li>{t("Para quedar a la par, el que tiene más le pasa al otro la mitad de la diferencia.")}</li>
        </ul>
      </div>
    </>
  );
}
