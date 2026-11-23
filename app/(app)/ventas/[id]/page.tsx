import { notFound } from "next/navigation";
import { Cabecera, Insignia } from "@/components/ui";
import { FormAccion, BotonEnviar } from "@/components/form-accion";
import { anularVenta } from "@/lib/actions/stock";
import { detalleVenta } from "@/lib/queries";
import { euros, fechaHora } from "@/lib/format";
import { METODOS_PAGO, etiqueta } from "@/lib/constants";

export default async function Venta({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const v = Number.isInteger(id) ? await detalleVenta(id) : null;
  if (!v) notFound();
  const coste = v.lineas.reduce((s, l) => s + l.cantidad * Number(l.costeUnidad), 0);
  const beneficio = Number(v.total) - coste;

  return (
    <>
      <Cabecera
        titulo={`Venta #${v.id}`}
        subtitulo={
          <>
            {fechaHora(v.fecha)} · {etiqueta(METODOS_PAGO, v.metodoPago)}{" "}
            {v.anulada && <Insignia tono="rojo">Anulada {v.anuladaEn ? fechaHora(v.anuladaEn) : ""}</Insignia>}
          </>
        }
        volver={{ href: "/ventas", texto: "Ventas" }}
      />
      <div className="tarjeta max-w-2xl overflow-hidden">
        <table className="tabla">
          <thead>
            <tr>
              <th>Producto</th>
              <th className="text-right">Uds.</th>
              <th className="text-right">Precio</th>
              <th className="text-right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {v.lineas.map((l) => (
              <tr key={l.id}>
                <td>
                  <div className="font-medium">{l.sabor}</div>
                  <div className="text-xs text-zinc-500">
                    {l.marca} {l.modelo} · {l.nicotinaMg} mg
                  </div>
                </td>
                <td className="text-right tabular-nums">{l.cantidad}</td>
                <td className="text-right tabular-nums">{euros(l.precioUnidad)}</td>
                <td className="text-right tabular-nums">{euros(l.cantidad * Number(l.precioUnidad))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="space-y-1 border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500">Subtotal</dt>
            <dd className="tabular-nums">{euros(v.subtotal)}</dd>
          </div>
          {Number(v.descuento) > 0 && (
            <div className="flex justify-between">
              <dt className="text-zinc-500">Descuento</dt>
              <dd className="tabular-nums">−{euros(v.descuento)}</dd>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{euros(v.total)}</dd>
          </div>
          <div className="flex justify-between text-zinc-500">
            <dt>Coste / beneficio</dt>
            <dd className="tabular-nums">
              {euros(coste)} / {euros(beneficio)}
            </dd>
          </div>
          <div className="flex justify-between text-zinc-500">
            <dt>Mayor de edad comprobado</dt>
            <dd>{v.mayorEdadVerificado ? "Sí" : "No"}</dd>
          </div>
        </dl>
      </div>

      {v.anulada && (
        <p className="mt-6 max-w-2xl rounded-lg bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          Venta anulada. Sus unidades volvieron al stock y no cuenta en los totales.
        </p>
      )}
      {!v.anulada && (
        <FormAccion accion={anularVenta} className="tarjeta mt-6 max-w-2xl p-4">
          <input type="hidden" name="id" value={v.id} />
          <h2 className="font-semibold">Anular venta</h2>
          <p className="mt-1 text-sm text-zinc-500">Para errores o devoluciones del ticket completo. Las unidades vuelven al stock.</p>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" name="confirmar" className="h-4 w-4" /> Sí, quiero anular esta venta
          </label>
          <div className="mt-3">
            <BotonEnviar className="btn-peligro" textoPendiente="Anulando…">
              Anular venta
            </BotonEnviar>
          </div>
        </FormAccion>
      )}
    </>
  );
}
