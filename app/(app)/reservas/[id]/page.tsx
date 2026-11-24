import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera, Insignia } from "@/components/ui";
import { FormAccion, BotonEnviar } from "@/components/form-accion";
import { nombreModelo } from "@/components/buscador";
import { cerrarReserva, confirmarReserva, editarReserva } from "@/lib/actions/reservas";
import { leerAjustes } from "@/lib/ajustes";
import { traductor } from "@/lib/i18n/servidor";
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
  const [r, a, t] = await Promise.all([Number.isInteger(id) ? detalleReserva(id) : null, leerAjustes(), traductor()]);
  if (!r) notFound();
  // Se puede tocar mientras no esté cerrada (aunque haya caducado)
  const abierta = r.estado === "pendiente" || r.estado === "confirmada" || r.estado === "caducada";
  const fechaCierre = r.cerradaEn ? fechaHora(r.cerradaEn) : null;

  return (
    <>
      <Cabecera
        titulo={t("Reserva {codigo}", { codigo: codigoVisible(r.codigo) })}
        subtitulo={
          <>
            {r.nombre} · {t("hecha el {fecha}", { fecha: fechaHora(r.creadaEn) })}{" "}
            <Insignia tono={r.estado === "pendiente" ? "ambar" : r.estado === "confirmada" ? "verde" : "gris"}>
              {t(ETIQUETA_ESTADO[r.estado])}
            </Insignia>
          </>
        }
        volver={{ href: "/reservas", texto: t("Reservas") }}
        acciones={
          <Link href={`/tienda/r/${r.codigo}`} target="_blank" className="btn-sec">
            {t("Lo que ve el cliente")}
          </Link>
        }
      />

      <div className="max-w-2xl space-y-5">
        <div className="rounded-xl border border-zinc-200 bg-superficie px-4 py-3 text-sm">
          {r.estado === "pendiente" && (
            <p>
              {t("Esperando a que la confirmes. Caduca {cuando} ({quedan}).", {
                cuando: cuando(r.caducaEn, t),
                quedan: tiempoRestante(r.caducaEn, t),
              })}{" "}
              {a.horasCerrar === 1
                ? t("Al confirmarla, queda apartada 1 hora.")
                : t("Al confirmarla, queda apartada {horas} horas.", { horas: a.horasCerrar })}
            </p>
          )}
          {r.estado === "confirmada" && (
            <p>
              {t("Confirmada. Apartada hasta {cuando} ({quedan}). Cuando cerréis la venta por WhatsApp, pulsa «Vender».", {
                cuando: cuando(r.caducaEn, t),
                quedan: tiempoRestante(r.caducaEn, t),
              })}
            </p>
          )}
          {r.estado === "caducada" && (
            <p>
              {t("Caducó {cuando}: sus unidades ya no están apartadas. Si el cliente sigue interesado, puedes reactivarla.", {
                cuando: cuando(r.caducaEn, t),
              })}
            </p>
          )}
          {r.estado === "vendida" && (
            <p>
              {t("Vendida.")}{" "}
              {r.ventaId && (
                <Link href={`/ventas/${r.ventaId}`} className="enlace">
                  {t("Ver la venta #{id}", { id: r.ventaId })}
                </Link>
              )}
            </p>
          )}
          {r.estado === "rechazada" && (
            <p>
              {fechaCierre ? t("Rechazada el {fecha}.", { fecha: fechaCierre }) : t("Rechazada.")} {t("Sus unidades están libres.")}
            </p>
          )}
          {r.estado === "cancelada" && (
            <p>
              {fechaCierre ? t("Cancelada el {fecha}.", { fecha: fechaCierre }) : t("Cancelada.")} {t("Sus unidades están libres.")}
            </p>
          )}
        </div>

        {abierta && (
          <div className="flex flex-wrap items-start gap-2">
            {r.estado === "confirmada" && (
              <Link href={`/ventas/nueva?reserva=${r.id}`} className="btn">
                {t("Vender")}
              </Link>
            )}
            <FormAccion accion={confirmarReserva}>
              <input type="hidden" name="id" value={r.id} />
              <BotonEnviar className={r.estado === "confirmada" ? "btn-sec" : "btn"} textoPendiente="…">
                {r.estado === "pendiente"
                  ? t("Confirmar")
                  : r.estado === "confirmada"
                    ? t("Ampliar {horas} h", { horas: a.horasCerrar })
                    : t("Reactivar y confirmar")}
              </BotonEnviar>
            </FormAccion>
            {r.estado === "pendiente" ? (
              <BotonCerrar id={r.id} estado="rechazada" texto={t("Rechazar")} />
            ) : (
              <BotonCerrar id={r.id} estado="cancelada" texto={t("Cancelar reserva")} />
            )}
          </div>
        )}

        {abierta ? (
          <FormAccion accion={editarReserva} className="tarjeta overflow-hidden">
            <input type="hidden" name="id" value={r.id} />
            <table className="tabla">
              <thead>
                <tr>
                  <th>{t("Producto")}</th>
                  <th className="text-right">{t("Precio")}</th>
                  <th className="w-24 text-right">{t("Uds.")}</th>
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
                        aria-label={t("Unidades de {sabor}", { sabor: l.sabor })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-3 border-t border-zinc-200 bg-zinc-50 p-4">
              <div className="flex justify-between font-semibold">
                <span>{t("Total")}</span>
                <span className="tabular-nums">{euros(r.total)}</span>
              </div>
              <div>
                <label className="etiqueta" htmlFor="notas">
                  {t("Notas")} <span className="font-normal text-zinc-400">{t("(solo las ves tú)")}</span>
                </label>
                <textarea
                  id="notas"
                  name="notas"
                  rows={2}
                  defaultValue={r.notas ?? ""}
                  className="campo"
                  placeholder={t("Ej. lo recoge el viernes")}
                />
              </div>
              <p className="text-xs text-zinc-500">{t("Si en el WhatsApp cambia algo, ajusta las cantidades (0 lo quita) y guarda.")}</p>
              <BotonEnviar className="btn-sec">{t("Guardar cambios")}</BotonEnviar>
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
