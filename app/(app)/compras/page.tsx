import Link from "next/link";
import { Cabecera, Insignia, Vacio } from "@/components/ui";
import { listarCompras } from "@/lib/queries";
import { euros, fecha } from "@/lib/format";

export default async function Compras() {
  const compras = await listarCompras();
  return (
    <>
      <Cabecera
        titulo="Compras"
        subtitulo="Pedidos a proveedores. Cada compra suma stock y actualiza el coste medio."
        acciones={
          <Link href="/compras/nueva" className="btn">
            Nueva compra
          </Link>
        }
      />
      {compras.length === 0 ? (
        <Vacio>
          Aún no hay compras.{" "}
          <Link href="/compras/nueva" className="enlace">
            Registra la primera
          </Link>
          .
        </Vacio>
      ) : (
        <div className="tarjeta overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Factura</th>
                <th className="text-right">Uds.</th>
                <th className="text-right">Total</th>
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
                  <td className="text-right">
                    {c.anulada && <Insignia tono="rojo">Anulada</Insignia>}{" "}
                    <Link href={`/compras/${c.id}`} className="enlace text-sm">
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
