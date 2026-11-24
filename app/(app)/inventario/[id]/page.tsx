import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera, Dato, Vacio } from "@/components/ui";
import { movimientosDeVariante, obtenerVariante } from "@/lib/queries";
import { MOTIVOS_AJUSTE, TIPOS_MOVIMIENTO } from "@/lib/constants";
import { euros, fechaHora } from "@/lib/format";
import { traductor } from "@/lib/i18n/servidor";

export default async function Movimientos({ params }: { params: Promise<{ id: string }> }) {
  const t = await traductor();
  const id = Number((await params).id);
  const v = Number.isInteger(id) ? await obtenerVariante(id) : null;
  if (!v) notFound();
  const movs = await movimientosDeVariante(id);
  // Saldo acumulado (los movimientos vienen del más nuevo al más antiguo)
  let saldo = v.stock;
  const conSaldo = movs.map((m) => {
    const fila = { ...m, saldo };
    saldo -= m.cantidad;
    return fila;
  });

  return (
    <>
      <Cabecera
        titulo={`${v.sabor} · ${v.nicotinaMg} mg`}
        subtitulo={`${v.marca} ${v.modelo}`}
        volver={{ href: "/inventario", texto: t("Inventario") }}
        acciones={
          <>
            <Link href={`/catalogo/variantes/${v.id}`} className="btn-sec">
              {t("Editar")}
            </Link>
            <Link href={`/inventario/ajuste?variante=${v.id}`} className="btn">
              {t("Ajustar stock")}
            </Link>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 [&>:last-child]:col-span-2 sm:[&>:last-child]:col-span-1">
        <Dato etiqueta={t("Stock")} valor={v.stock} detalle={t("Mínimo {n}", { n: v.stockMinimo })} />
        <Dato etiqueta={t("Precio")} valor={euros(v.precioVenta)} />
        <Dato etiqueta={t("Coste medio")} valor={Number(v.costeMedio) > 0 ? euros(v.costeMedio) : "—"} />
      </div>
      <h2 className="mb-2 font-semibold">{t("Movimientos")}</h2>
      {movs.length === 0 ? (
        <Vacio>{t("Sin movimientos todavía.")}</Vacio>
      ) : (
        <div className="tarjeta overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>{t("Fecha")}</th>
                <th>{t("Tipo")}</th>
                <th>{t("Detalle")}</th>
                <th className="text-right">{t("Cantidad")}</th>
                <th className="text-right">{t("Saldo")}</th>
              </tr>
            </thead>
            <tbody>
              {conSaldo.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap">{fechaHora(m.fecha)}</td>
                  <td>{t(TIPOS_MOVIMIENTO[m.tipo] ?? m.tipo)}</td>
                  <td className="text-zinc-500">
                    {m.ventaId && (
                      <Link href={`/ventas/${m.ventaId}`} className="enlace">
                        {t("Venta #{id}", { id: m.ventaId })}
                      </Link>
                    )}
                    {m.compraId && (
                      <Link href={`/compras/${m.compraId}`} className="enlace">
                        {t("Compra #{id}", { id: m.compraId })}
                      </Link>
                    )}
                    {m.motivo && motivoVisible(m.motivo, t)}
                  </td>
                  <td className={`text-right font-medium tabular-nums ${m.cantidad > 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                  </td>
                  <td className="text-right tabular-nums">{m.saldo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// El motivo de un ajuste se guarda como «Etiqueta — nota» en castellano: se traduce la etiqueta al mostrarlo
function motivoVisible(motivo: string, t: (s: string) => string) {
  const [etiqueta, ...resto] = motivo.split(" — ");
  if (!MOTIVOS_AJUSTE.some((x) => x.label === etiqueta)) return motivo;
  return [t(etiqueta), ...resto].join(" — ");
}
