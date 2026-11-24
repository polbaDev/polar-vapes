import Link from "next/link";
import { Cabecera, Dato, InsigniaDescuadre, Vacio } from "@/components/ui";
import { FormAccion, BotonEnviar } from "@/components/form-accion";
import { FormCierre } from "@/components/form-cierre";
import { crearMovimientoCaja, borrarMovimientoCaja } from "@/lib/actions/caja";
import { estadoCaja, listarCierres } from "@/lib/caja";
import { exigirSesion } from "@/lib/session";
import { listarSocios } from "@/lib/usuarios";
import { euros, fechaHora } from "@/lib/format";
import { traductor } from "@/lib/i18n/servidor";

export async function generateMetadata() {
  const t = await traductor();
  return { title: t("Caja") };
}

export default async function Caja() {
  const t = await traductor();
  const [estado, cierres, socios, yo] = await Promise.all([estadoCaja(), listarCierres(), listarSocios(), exigirSesion()]);
  const { periodo, cuentas, movimientos, esperado } = estado;
  const movimientoSinFondo = cuentas.ventasEfectivo - cuentas.devolucionesEfectivo + cuentas.entradas - cuentas.salidas;

  return (
    <>
      <Cabecera
        titulo={t("Caja")}
        subtitulo={
          periodo.ultimoId === null
            ? t("Primer cierre: cuenta lo que se ha vendido hoy")
            : t("Abierta desde el último cierre: {fecha}", { fecha: fechaHora(periodo.desde) })
        }
        acciones={
          <Link href="/ventas" className="btn-sec">
            {t("Ver ventas")}
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <section className="tarjeta overflow-hidden">
            <h2 className="border-b border-zinc-200 px-4 py-3 font-semibold">{t("Efectivo en el cajón")}</h2>
            <dl className="space-y-1.5 px-4 py-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">{t("Fondo con el que empezaste")}</dt>
                <dd className="tabular-nums">{periodo.fondoInicial === null ? t("lo pones al cerrar") : euros(periodo.fondoInicial)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">+ {t("Ventas en efectivo")}</dt>
                <dd className="tabular-nums">{euros(cuentas.ventasEfectivo)}</dd>
              </div>
              {cuentas.devolucionesEfectivo > 0 && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">− {t("Devoluciones y anulaciones en efectivo")}</dt>
                  <dd className="tabular-nums">{euros(cuentas.devolucionesEfectivo)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-zinc-500">+ {t("Entradas de dinero")}</dt>
                <dd className="tabular-nums">{euros(cuentas.entradas)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">− {t("Salidas de dinero")}</dt>
                <dd className="tabular-nums">{euros(cuentas.salidas)}</dd>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold">
                <dt>{t("Debería haber")}</dt>
                <dd className="tabular-nums">{esperado === null ? "—" : euros(esperado)}</dd>
              </div>
            </dl>
          </section>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 [&>:last-child]:col-span-2 sm:[&>:last-child]:col-span-1">
            <Dato etiqueta={t("Tickets")} valor={cuentas.tickets} />
            <Dato etiqueta={t("Tarjeta")} valor={euros(cuentas.ventasTarjeta)} detalle={t("Compáralo con el datáfono")} />
            <Dato etiqueta={t("Bizum")} valor={euros(cuentas.ventasBizum)} detalle={t("Compáralo con el móvil")} />
          </div>

          <section className="tarjeta overflow-hidden">
            <div className="border-b border-zinc-200 px-4 py-3">
              <h2 className="font-semibold">{t("Entradas y salidas de dinero")}</h2>
              <p className="mt-0.5 text-sm text-zinc-500">
                {t("Lo que metes o sacas del cajón sin ser una venta: pagar a un repartidor, llevar al banco, poner cambio…")}
              </p>
            </div>
            {movimientos.length > 0 && (
              <table className="tabla">
                <tbody>
                  {movimientos.map((m) => (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap text-xs text-zinc-500">{fechaHora(m.fecha)}</td>
                      <td>
                        {m.motivo}
                        {m.socio && (
                          <div className="text-xs text-zinc-500">
                            {m.tipo === "salida" ? t("Se lo lleva {nombre}", { nombre: m.socio }) : t("Lo pone {nombre}", { nombre: m.socio })}
                          </div>
                        )}
                      </td>
                      <td className={`whitespace-nowrap text-right font-medium tabular-nums ${m.tipo === "salida" ? "text-red-700" : "text-emerald-700"}`}>
                        {m.tipo === "salida" ? "−" : "+"}
                        {euros(m.importe)}
                      </td>
                      <td className="w-px text-right">
                        <FormAccion accion={borrarMovimientoCaja}>
                          <input type="hidden" name="id" value={m.id} />
                          <BotonEnviar className="text-sm text-zinc-400 hover:text-red-700" textoPendiente="…">
                            {t("Borrar")}
                          </BotonEnviar>
                        </FormAccion>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <FormAccion accion={crearMovimientoCaja} limpiarAlGuardar className="grid gap-3 border-t border-zinc-100 bg-zinc-50 p-4 sm:grid-cols-[auto_8rem_minmax(0,1fr)_auto] sm:items-end">
              <fieldset className="segmento self-start">
                <legend className="sr-only">{t("Tipo")}</legend>
                <label>
                  <input type="radio" name="tipo" value="salida" defaultChecked className="sr-only" /> {t("Sale")}
                </label>
                <label>
                  <input type="radio" name="tipo" value="entrada" className="sr-only" /> {t("Entra")}
                </label>
              </fieldset>
              <input name="importe" inputMode="decimal" placeholder={t("Importe €")} required aria-label={t("Importe")} className="campo text-right" />
              <input name="motivo" placeholder={t("Motivo (ej. Al banco)")} required aria-label={t("Motivo")} className="campo" />
              <BotonEnviar className="btn-sec">{t("Apuntar")}</BotonEnviar>
              {socios.length > 0 && (
                <div className="sm:col-span-4">
                  <label className="etiqueta" htmlFor="socio_caja">
                    {t("¿Se lo lleva o lo pone un socio?")}
                  </label>
                  <select id="socio_caja" name="socio" defaultValue="comun" className="campo sm:w-80">
                    <option value="comun">{t("No: es dinero de la tienda (pagos, banco de la tienda…)")}</option>
                    {socios.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-zinc-500">
                    {t("Si un socio se lleva el dinero, o lo pone de su bolsillo, cuenta en las cuentas entre socios.")}
                  </p>
                </div>
              )}
            </FormAccion>
          </section>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <FormCierre
            ultimoId={periodo.ultimoId}
            fondoInicial={periodo.fondoInicial}
            movimientoSinFondo={movimientoSinFondo}
            socios={socios}
            yo={yo.id}
          />
        </aside>
      </div>

      <h2 className="mb-2 mt-8 font-semibold">{t("Cierres anteriores")}</h2>
      {cierres.length === 0 ? (
        <Vacio>{t("Todavía no has cerrado la caja ninguna vez.")}</Vacio>
      ) : (
        <div className="tarjeta overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>{t("Cerrada")}</th>
                <th className="text-right">{t("Tickets")}</th>
                <th className="text-right">{t("Debería haber")}</th>
                <th className="text-right">{t("Contado")}</th>
                <th>{t("Resultado")}</th>
                <th className="text-right">{t("Se llevó")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cierres.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap">{fechaHora(c.hasta)}</td>
                  <td className="text-right tabular-nums">{c.tickets}</td>
                  <td className="text-right tabular-nums">{euros(c.esperado)}</td>
                  <td className="text-right tabular-nums">{euros(c.contado)}</td>
                  <td>
                    <InsigniaDescuadre valor={c.descuadre} />
                  </td>
                  <td className="text-right tabular-nums">
                    {euros(Number(c.contado) - Number(c.fondoSiguiente))}
                    {c.recibe && <div className="text-xs text-zinc-500">{c.recibe}</div>}
                  </td>
                  <td className="text-right">
                    <Link href={`/caja/${c.id}`} className="enlace text-sm">
                      {t("Ver")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
