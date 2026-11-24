import { notFound } from "next/navigation";
import { Cabecera, Insignia } from "@/components/ui";
import { FormAccion, BotonEnviar } from "@/components/form-accion";
import { FormDevolucion } from "@/components/form-devolucion";
import { anularVenta } from "@/lib/actions/stock";
import { cambiarRecibeVenta } from "@/lib/actions/socios";
import { detalleVenta } from "@/lib/queries";
import { listarSocios } from "@/lib/usuarios";
import { euros, fechaHora } from "@/lib/format";
import { METODOS_PAGO, etiqueta } from "@/lib/constants";
import { traductor } from "@/lib/i18n/servidor";

export default async function Venta({ params }: { params: Promise<{ id: string }> }) {
  const t = await traductor();
  const id = Number((await params).id);
  const [v, socios] = await Promise.all([Number.isInteger(id) ? detalleVenta(id) : null, listarSocios()]);
  if (!v) notFound();
  // Dónde acabó el dinero de esta venta
  const destino =
    v.metodoPago === "efectivo"
      ? t("Al cajón (de los dos)")
      : v.metodoPago === "bizum"
        ? v.recibe
          ? t("Bizum a {nombre}", { nombre: v.recibe })
          : t("Bizum, sin indicar a quién")
        : v.recibe
          ? t("Tarjeta, a la cuenta de {nombre}", { nombre: v.recibe })
          : t("Tarjeta, a la cuenta de la tienda");
  const devuelto = v.devoluciones.reduce((s, d) => s + Number(d.importe), 0);
  // Coste de lo que se queda el cliente (lo defectuoso devuelto sigue contando como coste: es pérdida)
  const coste = v.lineas.reduce((s, l) => s + l.cantidad * Number(l.costeUnidad) - Number(l.costeDevuelto), 0);
  const neto = Number(v.total) - devuelto;
  const beneficio = neto - coste;
  const quedanPorDevolver = v.lineas.some((l) => l.cantidad > l.devueltas);

  return (
    <>
      <Cabecera
        titulo={t("Venta #{id}", { id: v.id })}
        subtitulo={
          <>
            {fechaHora(v.fecha)} · {t(etiqueta(METODOS_PAGO, v.metodoPago))}
            {v.vendedor && <> · {t("Cobró {nombre}", { nombre: v.vendedor })}</>}{" "}
            {v.anulada && (
              <Insignia tono="rojo">
                {v.anuladaEn ? t("Anulada {fecha}", { fecha: fechaHora(v.anuladaEn) }) : t("Anulada")}
                {v.anuladaPor ? ` · ${v.anuladaPor}` : ""}
              </Insignia>
            )}
            {devuelto > 0 && <Insignia tono="ambar">{t("Con devoluciones")}</Insignia>}
          </>
        }
        volver={{ href: "/ventas", texto: t("Ventas") }}
      />
      <div className="tarjeta max-w-2xl overflow-hidden">
        <table className="tabla">
          <thead>
            <tr>
              <th>{t("Producto")}</th>
              <th className="text-right">{t("Uds.")}</th>
              <th className="text-right">{t("Precio")}</th>
              <th className="text-right">{t("Importe")}</th>
            </tr>
          </thead>
          <tbody>
            {v.lineas.map((l) => (
              <tr key={l.id}>
                <td>
                  <div className="font-medium">{l.sabor}</div>
                  <div className="text-xs text-zinc-500">
                    {l.marca} {l.modelo} · {l.nicotinaMg} mg
                    {l.devueltas > 0 && <span className="text-amber-700"> · {t("devueltas {n}", { n: l.devueltas })}</span>}
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
            <dt className="text-zinc-500">{t("Subtotal")}</dt>
            <dd className="tabular-nums">{euros(v.subtotal)}</dd>
          </div>
          {Number(v.descuento) > 0 && (
            <div className="flex justify-between">
              <dt className="text-zinc-500">{t("Descuento")}</dt>
              <dd className="tabular-nums">−{euros(v.descuento)}</dd>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold">
            <dt>{t("Total cobrado")}</dt>
            <dd className="tabular-nums">{euros(v.total)}</dd>
          </div>
          {devuelto > 0 && (
            <>
              <div className="flex justify-between">
                <dt className="text-zinc-500">{t("Devuelto")}</dt>
                <dd className="tabular-nums">−{euros(devuelto)}</dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt>{t("Queda cobrado")}</dt>
                <dd className="tabular-nums">{euros(neto)}</dd>
              </div>
            </>
          )}
          <div className="flex justify-between text-zinc-500">
            <dt>{t("Coste / beneficio")}</dt>
            <dd className="tabular-nums">
              {euros(coste)} / {euros(beneficio)}
            </dd>
          </div>
          <div className="flex justify-between text-zinc-500">
            <dt>{t("Mayor de edad comprobado")}</dt>
            <dd>{v.mayorEdadVerificado ? t("Sí") : t("No")}</dd>
          </div>
          <div className="flex justify-between gap-3 text-zinc-500">
            <dt>{t("Dinero")}</dt>
            <dd className="text-right">{destino}</dd>
          </div>
        </dl>
        {!v.anulada && v.metodoPago !== "efectivo" && socios.length > 0 && (
          <FormAccion accion={cambiarRecibeVenta} className="flex flex-wrap items-end gap-2 border-t border-zinc-200 px-4 py-3">
            <input type="hidden" name="id" value={v.id} />
            <div className="min-w-0 flex-1">
              <label className="etiqueta" htmlFor="recibe">
                {v.metodoPago === "bizum" ? t("¿A quién le llegó el Bizum?") : t("¿A qué cuenta fue la tarjeta?")}
              </label>
              <select id="recibe" name="recibe" defaultValue={v.recibeId ?? "comun"} className="campo">
                {socios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
                <option value="comun">{t("Cuenta de la tienda (de los dos)")}</option>
              </select>
            </div>
            <BotonEnviar className="btn-sec">{t("Cambiar")}</BotonEnviar>
          </FormAccion>
        )}
      </div>

      {v.devoluciones.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 font-semibold">{t("Devoluciones")}</h2>
          <div className="tarjeta max-w-2xl overflow-x-auto">
            <table className="tabla">
              <tbody>
                {v.devoluciones.map((d) => (
                  <tr key={d.id}>
                    <td className="whitespace-nowrap text-xs text-zinc-500">{fechaHora(d.fecha)}</td>
                    <td>
                      <div>{d.detalle}</div>
                      <div className="text-xs text-zinc-500">
                        {d.vuelveAlStock ? t("Volvió al stock") : t("Defectuoso, no vuelve al stock")}
                        {d.motivo ? ` · ${d.motivo}` : ""}
                        {d.paga ? ` · ${t("Lo devolvió {nombre}", { nombre: d.paga })}` : ""}
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <div className="font-medium tabular-nums">−{euros(d.importe)}</div>
                      <div className="text-xs text-zinc-500">{t(etiqueta(METODOS_PAGO, d.metodoPago))}</div>
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
          socios={socios}
          pagaPorDefecto={v.recibeId}
        />
      )}

      {v.anulada && (
        <p className="mt-6 max-w-2xl rounded-lg bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          {t("Venta anulada. Sus unidades volvieron al stock y no cuenta en los totales.")}
        </p>
      )}
      {!v.anulada && v.devoluciones.length === 0 && (
        <FormAccion accion={anularVenta} className="tarjeta mt-6 max-w-2xl p-4">
          <input type="hidden" name="id" value={v.id} />
          <h2 className="font-semibold">{t("Anular venta")}</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {t("Si la registraste por error. Todas las unidades vuelven al stock. Si el cliente devuelve productos, usa «Registrar devolución».")}
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" name="confirmar" className="h-4 w-4" /> {t("Sí, quiero anular esta venta")}
          </label>
          <div className="mt-3">
            <BotonEnviar className="btn-peligro" textoPendiente={t("Anulando…")}>
              {t("Anular venta")}
            </BotonEnviar>
          </div>
        </FormAccion>
      )}
    </>
  );
}
