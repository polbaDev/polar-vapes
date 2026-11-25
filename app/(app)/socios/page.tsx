import Link from "next/link";
import { Cabecera, Vacio } from "@/components/ui";
import { FormAccion, BotonEnviar } from "@/components/form-accion";
import { FormMovimientoSocio } from "@/components/form-socios";
import { anularMovimientoSocio, apuntarMovimientoSocio } from "@/lib/actions/socios";
import { exigirSesion } from "@/lib/session";
import { CATEGORIAS_SALDO, movimientosDinero, saldosSocios, ventasPorPersona, type CategoriaSaldo, type MovimientoDinero } from "@/lib/socios";
import { pagosParaIgualar, repartoBote } from "@/lib/socios-calculo";
import { listarVariantes } from "@/lib/queries";
import { PlanCompra } from "@/components/plan-compra";
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
  efectivo: tx("Ventas en efectivo que se quedó"),
  bizum: tx("Bizum que le llegaron"),
  tarjeta: tx("Tarjeta, a su cuenta"),
  aportacion: tx("Aportaciones que guarda"),
  aportado: tx("Aportaciones que puso"),
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
          {m.detalle === "tarjeta"
            ? t("Venta #{id} con tarjeta", { id: m.ref })
            : m.detalle === "efectivo"
              ? t("Venta #{id} en efectivo", { id: m.ref })
              : t("Venta #{id} por Bizum", { id: m.ref })}
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
    case "aportacion":
      return m.detalle ? `${t("Aportación al bote")} · ${m.detalle}` : t("Aportación al bote");
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

  const [yo, saldos, socios, movimientos, ventas, variantes] = await Promise.all([
    exigirSesion(),
    saldosSocios(),
    listarSocios(),
    movimientosDinero(),
    ventasPorPersona(desde, hoy),
    listarVariantes(),
  ]);
  // Entran en el reparto los socios (también uno desactivado al que aún le quede saldo)
  const delReparto = saldos.filter((s) => s.socio);
  const pagos = pagosParaIgualar(delReparto);
  // Cuentas que no son de socio pero tienen dinero de la tienda (por ejemplo, alguien que dejó de ser socio)
  const fuera = saldos.filter((s) => !s.socio);
  const filas = CATEGORIAS_SALDO.filter((c) => saldos.some((s) => Math.abs(s.desglose[c] ?? 0) >= 0.005));
  // El bote (todo el dinero de la tienda) y lo que es de cada socio: lo que aportó + su mitad de las ganancias
  const reparto = repartoBote(delReparto);
  // La cuenta del bote: lo que ha entrado y salido, sumando a los dos socios
  const suma = (cats: CategoriaSaldo[]) =>
    Math.round(delReparto.reduce((total, x) => total + cats.reduce((u, c) => u + (x.desglose[c] ?? 0), 0), 0) * 100) / 100;
  const ventasCobradas = suma(["efectivo", "bizum", "tarjeta", "devoluciones"]);
  const dineroAntes = suma(["ajuste"]);
  const gastado = suma(["compras", "gasto"]);
  const repartido = suma(["reparto"]);
  const conImporte = (f: { texto: string; importe: number }) => Math.abs(f.importe) >= 0.005;
  const cuentaBote = [
    { texto: tx("Ventas cobradas"), importe: ventasCobradas },
    { texto: tx("Dinero de antes de usar la app"), importe: dineroAntes },
    { texto: tx("Lo que habéis puesto vosotros"), importe: reparto.aportado },
    { texto: tx("Compras y gastos pagados"), importe: gastado },
    { texto: tx("Ganancias que os habéis repartido"), importe: repartido },
  ].filter(conImporte);
  // Lo mismo, a mitad para cada uno (lo que puso cada uno va aparte: es de quien lo puso)
  const n = Math.max(delReparto.length, 1);
  const mitades = [
    { texto: tx("Su mitad de lo que ha entrado (ventas y dinero de antes)"), importe: (ventasCobradas + dineroAntes) / n },
    { texto: tx("Su mitad de lo gastado (compras y gastos)"), importe: gastado / n },
    { texto: tx("Ganancias que ya se ha llevado"), importe: repartido / n },
  ].filter(conImporte);
  const valorStock = variantes.reduce((total, v) => total + Math.max(v.stock, 0) * Number(v.costeMedio), 0);
  const valorStockVenta = variantes.reduce((total, v) => total + Math.max(v.stock, 0) * Number(v.precioVenta), 0);
  const hayAportaciones = saldos.some((s) => s.aportado >= 0.005);
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

      {delReparto.length > 0 && (
        <section className="tarjeta mb-6 overflow-hidden">
          <h2 className="border-b border-zinc-200 px-4 py-3 font-semibold">{t("El bote de la tienda")}</h2>
          <div className="grid gap-6 px-4 py-4 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-zinc-500">{t("De dónde sale")}</h3>
              <dl className="space-y-1.5 text-sm">
                {cuentaBote.map((f) => (
                  <div key={f.texto} className="flex justify-between gap-4">
                    <dt className="text-zinc-600">{t(f.texto)}</dt>
                    <dd className="tabular-nums">
                      {f.importe > 0 ? "+" : "−"}
                      {euros(Math.abs(f.importe))}
                    </dd>
                  </div>
                ))}
                <div className="flex justify-between gap-4 border-t border-zinc-200 pt-1.5 text-base font-semibold">
                  <dt>{t("Queda en el bote")}</dt>
                  <dd className="tabular-nums">{euros(reparto.bote)}</dd>
                </div>
              </dl>
              {gastado < -0.005 && (
                <p className="mt-3 text-sm text-zinc-600">
                  {valorStock > 0.005
                    ? t("Lo gastado en compras está ahora en vapers: tenéis stock que costó {coste} y que vendido a su precio son {venta}.", {
                        coste: euros(valorStock),
                        venta: euros(valorStockVenta),
                      })
                    : t("Lo gastado en compras está ahora en vapers sin vender: el dinero vuelve al bote cuando se venden.")}
                </p>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-zinc-500">{t("Quién lo tiene")}</h3>
              <ul className="space-y-1.5 text-sm">
                {reparto.partes.map((s) => (
                  <li key={s.id}>
                    {s.tiene > 0.005
                      ? t("{nombre} tiene {importe} de la tienda.", { nombre: s.nombre, importe: euros(s.tiene) })
                      : s.tiene < -0.005
                        ? t("{nombre} ha adelantado {importe} de su bolsillo (la tienda se los debe).", {
                            nombre: s.nombre,
                            importe: euros(-s.tiene),
                          })
                        : t("{nombre} no tiene dinero de la tienda.", { nombre: s.nombre })}
                  </li>
                ))}
              </ul>
              {reparto.partes.some((s) => s.tiene > 0.005) && reparto.partes.some((s) => s.tiene < -0.005) && (
                <p className="mt-3 text-sm text-zinc-600">
                  {t("El bote es lo que tiene uno menos lo que ha adelantado el otro. Ese dinero tiene que pasar de uno a otro: lo veis abajo.")}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

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
        <>
          <section className="tarjeta mb-6 overflow-hidden">
            <div className="border-b border-zinc-200 px-4 py-3">
              <h2 className="font-semibold">{t("Lo de cada uno, a mitad y mitad")}</h2>
              <p className="mt-0.5 text-xs text-zinc-500">{t("Lo que le tocaría a cada uno si repartierais hoy el bote, y lo que tiene ahora.")}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th></th>
                    {reparto.partes.map((s) => (
                      <th key={s.id} className="text-right">
                        {s.nombre}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="text-zinc-600">{t("Puso de su bolsillo (aportaciones)")}</td>
                    {reparto.partes.map((s) => (
                      <td key={s.id} className="whitespace-nowrap text-right tabular-nums">
                        {euros(s.aportado)}
                      </td>
                    ))}
                  </tr>
                  {mitades.map((f) => (
                    <tr key={f.texto}>
                      <td className="text-zinc-600">{t(f.texto)}</td>
                      {reparto.partes.map((s) => (
                        <td key={s.id} className="whitespace-nowrap text-right tabular-nums">
                          {f.importe > 0 ? "+" : "−"}
                          {euros(Math.abs(f.importe))}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td>{t("Le toca")}</td>
                    {reparto.partes.map((s) => (
                      <td key={s.id} className="whitespace-nowrap text-right tabular-nums">
                        {euros(s.suyo)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="text-zinc-600">{t("Tiene ahora")}</td>
                    {reparto.partes.map((s) => (
                      <td key={s.id} className="whitespace-nowrap text-right tabular-nums">
                        {s.tiene < -0.005 ? (
                          <>
                            <span className="mr-1 text-xs text-zinc-500">{t("adelantó")}</span>
                            {euros(-s.tiene)}
                          </>
                        ) : (
                          euros(s.tiene)
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="space-y-3 border-t border-zinc-200 px-4 py-4">
              {pagos.length === 0 ? (
                <p className="text-lg font-medium text-emerald-700">{t("Cada uno tiene justo lo suyo: estáis a la par ✓")}</p>
              ) : (
                pagos.map((p) => (
                  <FormAccion key={`${p.deId}-${p.paraId}`} accion={apuntarMovimientoSocio} className="flex flex-wrap items-center justify-between gap-3">
                    <input type="hidden" name="tipo" value="pago" />
                    <input type="hidden" name="de" value={p.deId} />
                    <input type="hidden" name="para" value={p.paraId} />
                    <input type="hidden" name="importe" value={p.importe.toFixed(2)} />
                    <input type="hidden" name="motivo" value={t("Para quedar a la par")} />
                    <div>
                      <p className="text-lg">
                        <strong>{p.de}</strong> {t("le pasa")} <strong className="tabular-nums">{euros(p.importe)}</strong> {t("a")}{" "}
                        <strong>{p.para}</strong>
                      </p>
                      <p className="text-xs text-zinc-500">{t("Así cada uno se queda justo con lo que le toca.")}</p>
                    </div>
                    <BotonEnviar className="btn-sec" textoPendiente={t("Apuntando…")}>
                      {t("Ya está pagado: apuntarlo")}
                    </BotonEnviar>
                  </FormAccion>
                ))
              )}
            </div>
          </section>

          <section className="mb-6">
            <h2 className="font-semibold">{t("¿Vais a hacer una compra?")}</h2>
            <p className="mb-3 mt-0.5 text-sm text-zinc-500">
              {t("Escribe cuánto es y quién paga al proveedor: te dice cuánto le pasa el otro para pagarla a medias con el dinero del bote.")}
            </p>
            <PlanCompra socios={delReparto.map((s) => ({ id: s.id, nombre: s.nombre, saldo: s.saldo, tiene: s.tiene }))} yo={yo.id} />
          </section>
        </>
      )}

      {(filas.length > 0 || hayAportaciones) && (
        <section className="tarjeta mb-6 overflow-x-auto">
          <h2 className="border-b border-zinc-200 px-4 py-3 font-semibold">{t("Detalle: lo que ha cobrado y pagado cada uno")}</h2>
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
                    <td key={s.id} className="whitespace-nowrap text-right tabular-nums">
                      {s.desglose[c] ? euros(s.desglose[c]) : <span className="text-zinc-400">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="font-semibold">
                <td>{t("Tiene ahora")}</td>
                {saldos.map((s) => (
                  <td key={s.id} className="whitespace-nowrap text-right tabular-nums">
                    {euros(s.tiene)}
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
          <Vacio>{t("Todavía no hay nada. Aquí saldrán las ventas, las aportaciones, las compras que paguéis y los pagos entre vosotros.")}</Vacio>
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
                  const propio = ["aportacion", "pago", "gasto", "reparto", "ajuste"].includes(m.tipo);
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
          <li>{t("No hace falta contar el dinero: basta con apuntar cada venta, compra y aportación con quién se queda o paga el dinero.")}</li>
          <li>{t("El bote es todo el dinero de la tienda: lo que ha entrado (ventas, dinero de antes y lo que habéis puesto) menos lo que se ha gastado.")}</li>
          <li>{t("A cada uno le toca lo que puso de su bolsillo más la mitad de lo que ha entrado, menos la mitad de lo gastado.")}</li>
          <li>{t("Si alguien tiene más de lo que le toca, le pasa la diferencia al otro. Si ha adelantado dinero, el otro se lo devuelve.")}</li>
        </ul>
      </div>
    </>
  );
}
