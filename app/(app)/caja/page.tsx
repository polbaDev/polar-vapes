import Link from "next/link";
import { Cabecera, Dato, InsigniaDescuadre, Vacio } from "@/components/ui";
import { FormAccion, BotonEnviar } from "@/components/form-accion";
import { FormCierre } from "@/components/form-cierre";
import { crearMovimientoCaja, borrarMovimientoCaja } from "@/lib/actions/caja";
import { estadoCaja, listarCierres } from "@/lib/caja";
import { euros, fechaHora } from "@/lib/format";

export const metadata = { title: "Caja · Gestión Vapers" };

export default async function Caja() {
  const [estado, cierres] = await Promise.all([estadoCaja(), listarCierres()]);
  const { periodo, cuentas, movimientos, esperado } = estado;
  const movimientoSinFondo = cuentas.ventasEfectivo - cuentas.devolucionesEfectivo + cuentas.entradas - cuentas.salidas;

  return (
    <>
      <Cabecera
        titulo="Caja"
        subtitulo={
          periodo.ultimoId === null
            ? "Primer cierre: cuenta lo que se ha vendido hoy"
            : `Abierta desde el último cierre: ${fechaHora(periodo.desde)}`
        }
        acciones={
          <Link href="/ventas" className="btn-sec">
            Ver ventas
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <section className="tarjeta overflow-hidden">
            <h2 className="border-b border-zinc-200 px-4 py-3 font-semibold">Efectivo en el cajón</h2>
            <dl className="space-y-1.5 px-4 py-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Fondo con el que empezaste</dt>
                <dd className="tabular-nums">{periodo.fondoInicial === null ? "lo pones al cerrar" : euros(periodo.fondoInicial)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">+ Ventas en efectivo</dt>
                <dd className="tabular-nums">{euros(cuentas.ventasEfectivo)}</dd>
              </div>
              {cuentas.devolucionesEfectivo > 0 && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">− Devoluciones y anulaciones en efectivo</dt>
                  <dd className="tabular-nums">{euros(cuentas.devolucionesEfectivo)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-zinc-500">+ Entradas de dinero</dt>
                <dd className="tabular-nums">{euros(cuentas.entradas)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">− Salidas de dinero</dt>
                <dd className="tabular-nums">{euros(cuentas.salidas)}</dd>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold">
                <dt>Debería haber</dt>
                <dd className="tabular-nums">{esperado === null ? "—" : euros(esperado)}</dd>
              </div>
            </dl>
          </section>

          <div className="grid grid-cols-3 gap-3">
            <Dato etiqueta="Tickets" valor={cuentas.tickets} />
            <Dato etiqueta="Tarjeta" valor={euros(cuentas.ventasTarjeta)} detalle="Compáralo con el datáfono" />
            <Dato etiqueta="Bizum" valor={euros(cuentas.ventasBizum)} detalle="Compáralo con el móvil" />
          </div>

          <section className="tarjeta overflow-hidden">
            <div className="border-b border-zinc-200 px-4 py-3">
              <h2 className="font-semibold">Entradas y salidas de dinero</h2>
              <p className="mt-0.5 text-sm text-zinc-500">Lo que metes o sacas del cajón sin ser una venta: pagar a un repartidor, llevar al banco, poner cambio…</p>
            </div>
            {movimientos.length > 0 && (
              <table className="tabla">
                <tbody>
                  {movimientos.map((m) => (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap text-xs text-zinc-500">{fechaHora(m.fecha)}</td>
                      <td>{m.motivo}</td>
                      <td className={`whitespace-nowrap text-right font-medium tabular-nums ${m.tipo === "salida" ? "text-red-700" : "text-emerald-700"}`}>
                        {m.tipo === "salida" ? "−" : "+"}
                        {euros(m.importe)}
                      </td>
                      <td className="w-px text-right">
                        <FormAccion accion={borrarMovimientoCaja}>
                          <input type="hidden" name="id" value={m.id} />
                          <BotonEnviar className="text-sm text-zinc-400 hover:text-red-700" textoPendiente="…">
                            Borrar
                          </BotonEnviar>
                        </FormAccion>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <FormAccion accion={crearMovimientoCaja} limpiarAlGuardar className="grid gap-3 border-t border-zinc-100 bg-zinc-50 p-4 sm:grid-cols-[auto_8rem_minmax(0,1fr)_auto] sm:items-end">
              <fieldset className="flex gap-1 rounded-lg bg-zinc-200/70 p-1 text-sm">
                <legend className="sr-only">Tipo</legend>
                <label className="cursor-pointer rounded-md px-3 py-1.5 font-medium text-zinc-600 has-[:checked]:bg-white has-[:checked]:text-zinc-900 has-[:checked]:shadow-sm">
                  <input type="radio" name="tipo" value="salida" defaultChecked className="sr-only" /> Sale
                </label>
                <label className="cursor-pointer rounded-md px-3 py-1.5 font-medium text-zinc-600 has-[:checked]:bg-white has-[:checked]:text-zinc-900 has-[:checked]:shadow-sm">
                  <input type="radio" name="tipo" value="entrada" className="sr-only" /> Entra
                </label>
              </fieldset>
              <input name="importe" inputMode="decimal" placeholder="Importe €" required aria-label="Importe" className="campo text-right" />
              <input name="motivo" placeholder="Motivo (ej. Al banco)" required aria-label="Motivo" className="campo" />
              <BotonEnviar className="btn-sec">Apuntar</BotonEnviar>
            </FormAccion>
          </section>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <FormCierre ultimoId={periodo.ultimoId} fondoInicial={periodo.fondoInicial} movimientoSinFondo={movimientoSinFondo} />
        </aside>
      </div>

      <h2 className="mb-2 mt-8 font-semibold">Cierres anteriores</h2>
      {cierres.length === 0 ? (
        <Vacio>Todavía no has cerrado la caja ninguna vez.</Vacio>
      ) : (
        <div className="tarjeta overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Cerrada</th>
                <th className="text-right">Tickets</th>
                <th className="text-right">Debería haber</th>
                <th className="text-right">Contado</th>
                <th>Resultado</th>
                <th className="text-right">Te llevaste</th>
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
                  <td className="text-right tabular-nums">{euros(Number(c.contado) - Number(c.fondoSiguiente))}</td>
                  <td className="text-right">
                    <Link href={`/caja/${c.id}`} className="enlace text-sm">
                      Ver
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
