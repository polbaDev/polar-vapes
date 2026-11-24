import Link from "next/link";
import { Cabecera, Insignia, Vacio } from "@/components/ui";
import { listarCompras } from "@/lib/queries";
import { euros, fecha } from "@/lib/format";
import { traductor } from "@/lib/i18n/servidor";

export default async function Compras() {
  const t = await traductor();
  const compras = await listarCompras();
  return (
    <>
      <Cabecera
        titulo={t("Compras")}
        subtitulo={t("Pedidos a proveedores. Cada compra suma stock y actualiza el coste medio.")}
        acciones={
          <>
            <Link href="/compras/pedido" className="btn-sec">
              {t("Pedido sugerido")}
            </Link>
            <Link href="/compras/nueva" className="btn">
              {t("Nueva compra")}
            </Link>
          </>
        }
      />
      {compras.length === 0 ? (
        <Vacio>
          {t("Aún no hay compras.")}{" "}
          <Link href="/compras/nueva" className="enlace">
            {t("Registra la primera")}
          </Link>
          .
        </Vacio>
      ) : (
        <div className="tarjeta overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>{t("Fecha")}</th>
                <th>{t("Proveedor")}</th>
                <th>{t("Factura")}</th>
                <th className="text-right">{t("Uds.")}</th>
                <th className="text-right">{t("Total")}</th>
                <th>{t("La pagó")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {compras.map((c) => (
                <tr key={c.id} className={c.anulada ? "text-zinc-400" : ""}>
                  <td className="whitespace-nowrap">{fecha(c.fecha)}</td>
                  <td>{c.proveedor ?? <span className="text-zinc-400">—</span>}</td>
                  <td>{c.numFactura ?? <span className="text-zinc-400">—</span>}</td>
                  <td className="text-right tabular-nums">{c.unidades}</td>
                  <td className="text-right font-medium tabular-nums">{euros(c.total)}</td>
                  <td>{c.paga ?? <span className="text-zinc-400">{t("La tienda")}</span>}</td>
                  <td className="text-right">
                    {c.anulada && <Insignia tono="rojo">{t("Anulada")}</Insignia>}{" "}
                    <Link href={`/compras/${c.id}`} className="enlace text-sm">
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
