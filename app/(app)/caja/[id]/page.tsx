import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera, Dato, InsigniaDescuadre } from "@/components/ui";
import { FormAccion, BotonEnviar } from "@/components/form-accion";
import { reabrirCaja } from "@/lib/actions/caja";
import { detalleCierre, listarCierres } from "@/lib/caja";
import { diaISO, euros, fechaHora } from "@/lib/format";

export default async function Cierre({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nuevo?: string }>;
}) {
  const id = Number((await params).id);
  const { nuevo } = await searchParams;
  const [c, [ultimo]] = await Promise.all([Number.isInteger(id) ? detalleCierre(id) : null, listarCierres(1)]);
  if (!c) notFound();
  const descuadre = Number(c.descuadre);
  const teLlevaste = Number(c.contado) - Number(c.fondoSiguiente);
  const esElUltimo = ultimo?.id === c.id;

  return (
    <>
      <Cabecera
        titulo={`Cierre de caja #${c.id}`}
        subtitulo={`${fechaHora(c.desde)} → ${fechaHora(c.hasta)}`}
        volver={{ href: "/caja", texto: "Caja" }}
        acciones={
          <Link href={`/ventas?desde=${diaISO(c.desde)}&hasta=${diaISO(c.hasta)}`} className="btn-sec">
            Ver ventas
          </Link>
        }
      />

      {nuevo && (
        <p className="mb-5 max-w-2xl rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Caja cerrada. Las ventas que hagas a partir de ahora van al siguiente cierre.
        </p>
      )}

      <div className="mb-5 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
        <Dato etiqueta="Resultado" valor={<InsigniaDescuadre valor={descuadre} />} />
        <Dato etiqueta="Te llevaste" valor={euros(teLlevaste)} />
        <Dato etiqueta="Dejaste en caja" valor={euros(c.fondoSiguiente)} />
      </div>

      <div className="tarjeta max-w-2xl overflow-hidden">
        <dl className="space-y-1.5 px-4 py-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500">Fondo con el que empezaste</dt>
            <dd className="tabular-nums">{euros(c.fondoInicial)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">+ Ventas en efectivo</dt>
            <dd className="tabular-nums">{euros(c.ventasEfectivo)}</dd>
          </div>
          {Number(c.devolucionesEfectivo) > 0 && (
            <div className="flex justify-between">
              <dt className="text-zinc-500">− Ventas en efectivo anuladas</dt>
              <dd className="tabular-nums">{euros(c.devolucionesEfectivo)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-zinc-500">+ Entradas de dinero</dt>
            <dd className="tabular-nums">{euros(c.entradas)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">− Salidas de dinero</dt>
            <dd className="tabular-nums">{euros(c.salidas)}</dd>
          </div>
          <div className="flex justify-between border-t border-zinc-200 pt-2 font-semibold">
            <dt>Debería haber</dt>
            <dd className="tabular-nums">{euros(c.esperado)}</dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>Contado</dt>
            <dd className="tabular-nums">{euros(c.contado)}</dd>
          </div>
        </dl>
        <dl className="space-y-1.5 border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500">Tickets</dt>
            <dd className="tabular-nums">{c.tickets}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">Cobrado con tarjeta</dt>
            <dd className="tabular-nums">{euros(c.ventasTarjeta)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">Cobrado por Bizum</dt>
            <dd className="tabular-nums">{euros(c.ventasBizum)}</dd>
          </div>
          {c.notas && <p className="whitespace-pre-line pt-2 text-zinc-700">{c.notas}</p>}
        </dl>
      </div>

      {c.movimientos.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 font-semibold">Entradas y salidas de dinero</h2>
          <div className="tarjeta max-w-2xl overflow-x-auto">
            <table className="tabla">
              <tbody>
                {c.movimientos.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap text-xs text-zinc-500">{fechaHora(m.fecha)}</td>
                    <td>{m.motivo}</td>
                    <td className={`whitespace-nowrap text-right font-medium tabular-nums ${m.tipo === "salida" ? "text-red-700" : "text-emerald-700"}`}>
                      {m.tipo === "salida" ? "−" : "+"}
                      {euros(m.importe)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {esElUltimo && (
        <FormAccion accion={reabrirCaja} className="tarjeta mt-6 max-w-2xl p-4">
          <input type="hidden" name="id" value={c.id} />
          <h2 className="font-semibold">Reabrir caja</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Si contaste mal o se te olvidó apuntar algo. Se borra este cierre y la caja vuelve a quedar abierta desde{" "}
            {fechaHora(c.desde)}, con todo lo que se ha vendido desde entonces.
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" name="confirmar" className="h-4 w-4" /> Sí, quiero reabrir la caja
          </label>
          <div className="mt-3">
            <BotonEnviar className="btn-peligro" textoPendiente="Reabriendo…">
              Reabrir caja
            </BotonEnviar>
          </div>
        </FormAccion>
      )}
    </>
  );
}
