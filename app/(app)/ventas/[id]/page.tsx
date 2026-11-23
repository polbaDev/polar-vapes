import { notFound } from "next/navigation";
import { Cabecera, Insignia } from "@/components/ui";
import { FormAccion, BotonEnviar } from "@/components/form-accion";
import { FormDevolucion } from "@/components/form-devolucion";
import { anularVenta } from "@/lib/actions/stock";
import { detalleVenta } from "@/lib/queries";
import { euros, fechaHora } from "@/lib/format";
import { METODOS_PAGO, etiqueta } from "@/lib/constants";

export default async function Venta({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const v = Number.isInteger(id) ? await detalleVenta(id) : null;
  if (!v) notFound();
  const devuelto = v.devoluciones.reduce((s, d) => s + Number(d.importe), 0);
  // Coste de lo que se queda el cliente (lo defectuoso devuelto sigue contando como coste: es pérdida)
  const coste = v.lineas.reduce((s, l) => s + l.cantidad * Number(l.costeUnidad) - Number(l.costeDevuelto), 0);
  const neto = Number(v.total) - devuelto;
  const beneficio = neto - coste;
  const quedanPorDevolver = v.lineas.some((l) => l.devueltas < l.cantidad);

  return (
    <>
      <Cabecera
        titulo={`Venta #${v.id}`}
        subtitulo={
          <>
            {fechaHora(v.fecha)} · {etiqueta(METODOS_PAGO, v.metodoPago)}{" "}
            {v.anulada && <Insignia tono="rojo">Anulada {v.anuladaEn ? fechaHora(v.anuladaEn) : ""}</Insignia>}
            {devuelto > 0 && <Insignia tono="ambar">Con devoluciones</Insignia>}
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
                    {l.devueltas > 0 && <span className="text-amber-700"> · devueltas {l.devueltas}</span>}
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
            <dt>Total cobrado</dt>
            <dd className="tabular-nums">{euros(v.total)}</dd>
          </div>
          {devuelto > 0 && (
            <>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Devuelto</dt>
                <dd className="tabular-nums">−{euros(devuelto)}</dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt>Queda cobrado</dt>
                <dd className="tabular-nums">{euros(neto)}</dd>
              </div>
            </>
          )}
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

      {v.devoluciones.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 font-semibold">Devoluciones</h2>
          <div className="tarjeta max-w-2xl overflow-x-auto">
            <table className="tabla">
              <tbody>
                {v.devoluciones.map((d) => (
                  <tr key={d.id}>
                    <td className="whitespace-nowrap text-xs text-zinc-500">{fechaHora(d.fecha)}</td>
                    <td>
                      <div>{d.detalle}</div>
                      <div className="text-xs text-zinc-500">
                        {d.vuelveAlStock ? "Volvió al stock" : "Defectuoso, no vuelve al stock"}
                        {d.motivo ? ` · ${d.motivo}` : ""}
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <div className="font-medium tabular-nums">−{euros(d.importe)}</div>
                      <div className="text-xs text-zinc-500">{etiqueta(METODOS_PAGO, d.metodoPago)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!v.anulada && quedanPorDevolver && (
        <FormDevolucion
          ventaId={v.id}
          metodoPago={v.metodoPago}
          total={Number(v.total)}
          subtotal={Number(v.subtotal)}
          yaDevuelto={devuelto}
          lineas={v.lineas.map((l) => ({
            id: l.id,
            sabor: l.sabor,
            detalle: `${l.marca} ${l.modelo} · ${l.nicotinaMg} mg`,
            cantidad: l.cantidad,
            devueltas: l.devueltas,
            precioUnidad: Number(l.precioUnidad),
          }))}
        />
      )}

      {v.anulada && (
        <p className="mt-6 max-w-2xl rounded-lg bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          Venta anulada. Sus unidades volvieron al stock y no cuenta en los totales.
        </p>
      )}
      {!v.anulada && v.devoluciones.length === 0 && (
        <FormAccion accion={anularVenta} className="tarjeta mt-6 max-w-2xl p-4">
          <input type="hidden" name="id" value={v.id} />
          <h2 className="font-semibold">Anular venta</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Si la registraste por error. Todas las unidades vuelven al stock. Si el cliente devuelve productos, usa «Registrar devolución».
          </p>
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
