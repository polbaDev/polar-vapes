import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera, Insignia } from "@/components/ui";
import { FormAccion, BotonEnviar } from "@/components/form-accion";
import { anularCompra } from "@/lib/actions/stock";
import { detalleCompra } from "@/lib/queries";
import { euros, fecha, fechaHora } from "@/lib/format";
import { traductor } from "@/lib/i18n/servidor";

export default async function Compra({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nueva?: string }>;
}) {
  const t = await traductor();
  const id = Number((await params).id);
  const { nueva } = await searchParams;
  const c = Number.isInteger(id) ? await detalleCompra(id) : null;
  if (!c) notFound();
  const subtotal = c.lineas.reduce((s, l) => s + l.cantidad * Number(l.costeUnidad), 0);
  const envio = Number(c.gastosEnvio);

  return (
    <>
      <Cabecera
        titulo={t("Compra #{id}", { id: c.id })}
        subtitulo={
          <>
            {fecha(c.fecha)}
            {c.proveedor ? ` · ${c.proveedor}` : ""}
            {c.numFactura ? ` · ${t("Factura {numero}", { numero: c.numFactura })}` : ""}{" "}
            {c.anulada && (
              <Insignia tono="rojo">{c.anuladaEn ? t("Anulada {fecha}", { fecha: fechaHora(c.anuladaEn) }) : t("Anulada")}</Insignia>
            )}
          </>
        }
        volver={{ href: "/compras", texto: t("Compras") }}
        acciones={
          <Link href="/compras/nueva" className="btn-sec">
            {t("Otra compra")}
          </Link>
        }
      />
      {nueva && !c.anulada && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{t("Compra guardada. El stock y los costes ya están actualizados.")}</p>
      )}
      <div className="tarjeta overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr>
              <th>{t("Producto")}</th>
              <th>{t("Lote")}</th>
              <th className="text-right">{t("Uds.")}</th>
              <th className="text-right">{t("Coste/ud.")}</th>
              {envio > 0 && <th className="text-right">{t("Coste real/ud.")}</th>}
              <th className="text-right">{t("Importe")}</th>
            </tr>
          </thead>
          <tbody>
            {c.lineas.map((l) => (
              <tr key={l.id}>
                <td>
                  <Link href={`/inventario/${l.varianteId}`} className="font-medium hover:underline">
                    {l.sabor}
                  </Link>
                  <div className="text-xs text-zinc-500">
                    {l.marca} {l.modelo} · {l.nicotinaMg} mg
                  </div>
                </td>
                <td className="text-zinc-500">{l.lote ?? "—"}</td>
                <td className="text-right tabular-nums">{l.cantidad}</td>
                <td className="text-right tabular-nums">{euros(l.costeUnidad)}</td>
                {envio > 0 && <td className="text-right tabular-nums text-zinc-500">{euros(l.costeReal)}</td>}
                <td className="text-right tabular-nums">{euros(l.cantidad * Number(l.costeUnidad))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="space-y-1 border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500">{t("Productos")}</dt>
            <dd className="tabular-nums">{euros(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">{t("Envío")}</dt>
            <dd className="tabular-nums">{euros(envio)}</dd>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <dt>{t("Total")}</dt>
            <dd className="tabular-nums">{euros(c.total)}</dd>
          </div>
          {c.notas && <p className="pt-2 text-zinc-600">{c.notas}</p>}
        </dl>
      </div>

      {c.anulada && (
        <p className="mt-6 max-w-2xl rounded-lg bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          {t("Compra anulada. Sus unidades se retiraron del stock.")}
        </p>
      )}
      {!c.anulada && (
        <FormAccion accion={anularCompra} className="tarjeta mt-6 max-w-2xl p-4">
          <input type="hidden" name="id" value={c.id} />
          <h2 className="font-semibold">{t("Anular compra")}</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {t("Si la registraste por error. Retira esas unidades del stock (solo es posible si aún no las has vendido).")}
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" name="confirmar" className="h-4 w-4" /> {t("Sí, quiero anular esta compra")}
          </label>
          <div className="mt-3">
            <BotonEnviar className="btn-peligro" textoPendiente={t("Anulando…")}>
              {t("Anular compra")}
            </BotonEnviar>
          </div>
        </FormAccion>
      )}
    </>
  );
}
