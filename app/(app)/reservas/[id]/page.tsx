import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera, Insignia } from "@/components/ui";
import { FormAccion, BotonEnviar } from "@/components/form-accion";
import { nombreModelo } from "@/components/buscador";
import { cerrarReserva, confirmarReserva, editarReserva } from "@/lib/actions/reservas";
import { leerAjustes } from "@/lib/ajustes";
import { codigoVisible, detalleReserva, ETIQUETA_ESTADO, tiempoRestante } from "@/lib/reservas";
import { cuando, euros, fechaHora } from "@/lib/format";

function BotonCerrar({ id, estado, texto }: { id: number; estado: "rechazada" | "cancelada"; texto: string }) {
  return (
    <FormAccion accion={cerrarReserva}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="estado" value={estado} />
      <BotonEnviar className="btn-peligro" textoPendiente="…">
        {texto}
      </BotonEnviar>
    </FormAccion>
  );
}

export default async function Reserva({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const [r, a] = await Promise.all([Number.isInteger(id) ? detalleReserva(id) : null, leerAjustes()]);
  if (!r) notFound();
  // Se puede tocar mientras no esté cerrada (aunque haya caducado)
  const abierta = r.estado === "pendiente" || r.estado === "confirmada" || r.estado === "caducada";

  return (
    <>
      <Cabecera
        titulo={`Reserva ${codigoVisible(r.codigo)}`}
        subtitulo={
          <>
            {r.nombre} · hecha el {fechaHora(r.creadaEn)}{" "}
            <Insignia tono={r.estado === "pendiente" ? "ambar" : r.estado === "confirmada" ? "verde" : "gris"}>
              {ETIQUETA_ESTADO[r.estado]}
            </Insignia>
          </>
        }
        volver={{ href: "/reservas", texto: "Reservas" }}
        acciones={
          <Link href={`/tienda/r/${r.codigo}`} target="_blank" className="btn-sec">
            Lo que ve el cliente
          </Link>
        }
      />

      <div className="max-w-2xl space-y-5">
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm">
          {r.estado === "pendiente" && (
            <p>
              Esperando a que la confirmes. Caduca {cuando(r.caducaEn)} ({tiempoRestante(r.caducaEn)}). Al confirmarla, queda apartada{" "}
              {a.horasCerrar} horas.
            </p>
          )}
          {r.estado === "confirmada" && (
            <p>
              Confirmada. Apartada hasta {cuando(r.caducaEn)} ({tiempoRestante(r.caducaEn)}). Cuando cerréis la venta por WhatsApp, pulsa
              «Vender».
            </p>
          )}
          {r.estado === "caducada" && (
            <p>Caducó {cuando(r.caducaEn)}: sus unidades ya no están apartadas. Si el cliente sigue interesado, puedes reactivarla.</p>
          )}
          {r.estado === "vendida" && (
            <p>
              Vendida.{" "}
              {r.ventaId && (
                <Link href={`/ventas/${r.ventaId}`} className="enlace">
                  Ver la venta #{r.ventaId}
                </Link>
              )}
            </p>
          )}
          {(r.estado === "rechazada" || r.estado === "cancelada") && (
            <p>
              {ETIQUETA_ESTADO[r.estado]}
              {r.cerradaEn ? ` el ${fechaHora(r.cerradaEn)}` : ""}. Sus unidades están libres.
            </p>
          )}
        </div>

        {abierta && (
          <div className="flex flex-wrap items-start gap-2">
            {r.estado === "confirmada" && (
              <Link href={`/ventas/nueva?reserva=${r.id}`} className="btn">
                Vender
              </Link>
            )}
            <FormAccion accion={confirmarReserva}>
              <input type="hidden" name="id" value={r.id} />
              <BotonEnviar className={r.estado === "confirmada" ? "btn-sec" : "btn"} textoPendiente="…">
                {r.estado === "pendiente" ? "Confirmar" : r.estado === "confirmada" ? `Ampliar ${a.horasCerrar} h` : "Reactivar y confirmar"}
              </BotonEnviar>
            </FormAccion>
            {r.estado === "pendiente" ? (
              <BotonCerrar id={r.id} estado="rechazada" texto="Rechazar" />
            ) : (
              <BotonCerrar id={r.id} estado="cancelada" texto="Cancelar reserva" />
            )}
          </div>
        )}

        {abierta ? (
          <FormAccion accion={editarReserva} className="tarjeta overflow-hidden">
            <input type="hidden" name="id" value={r.id} />
            <table className="tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="text-right">Precio</th>
                  <th className="w-24 text-right">Uds.</th>
                </tr>
              </thead>
              <tbody>
                {r.lineas.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <div className="font-medium">{l.sabor}</div>
                      <div className="text-xs text-zinc-500">
                        {nombreModelo(l)} · {l.nicotinaMg} mg
                      </div>
                    </td>
                    <td className="text-right tabular-nums">{euros(l.precioUnidad)}</td>
                    <td className="text-right">
                      <input
                        name={`cantidad_${l.id}`}
                        type="number"
                        min={0}
                        defaultValue={l.cantidad}
                        inputMode="numeric"
                        className="campo w-20 py-1 text-right"
                        aria-label={`Unidades de ${l.sabor}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-3 border-t border-zinc-200 bg-zinc-50 p-4">
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{euros(r.total)}</span>
              </div>
              <div>
                <label className="etiqueta" htmlFor="notas">
                  Notas <span className="font-normal text-zinc-400">(solo las ves tú)</span>
                </label>
                <textarea id="notas" name="notas" rows={2} defaultValue={r.notas ?? ""} className="campo" placeholder="Ej. lo recoge el viernes" />
              </div>
              <p className="text-xs text-zinc-500">Si en el WhatsApp cambia algo, ajusta las cantidades (0 lo quita) y guarda.</p>
              <BotonEnviar className="btn-sec">Guardar cambios</BotonEnviar>
            </div>
          </FormAccion>
        ) : (
          <div className="tarjeta overflow-hidden">
            <ul className="divide-y divide-zinc-100 text-sm">
              {r.lineas.map((l) => (
                <li key={l.id} className="flex justify-between px-4 py-2.5">
                  <span>
                    {l.cantidad} × {l.sabor} <span className="text-zinc-500">({nombreModelo(l)} · {l.nicotinaMg} mg)</span>
                  </span>
                  <span className="tabular-nums">{euros(l.cantidad * Number(l.precioUnidad))}</span>
                </li>
              ))}
            </ul>
            {r.notas && <p className="border-t border-zinc-200 px-4 py-2.5 text-sm text-zinc-600">{r.notas}</p>}
          </div>
        )}
      </div>
    </>
  );
}
