import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera, Dato, Vacio } from "@/components/ui";
import { movimientosDeVariante, obtenerVariante } from "@/lib/queries";
import { TIPOS_MOVIMIENTO } from "@/lib/constants";
import { euros, fechaHora } from "@/lib/format";

export default async function Movimientos({ params }: { params: Promise<{ id: string }> }) {
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
        volver={{ href: "/inventario", texto: "Inventario" }}
        acciones={
          <>
            <Link href={`/catalogo/variantes/${v.id}`} className="btn-sec">
              Editar
            </Link>
            <Link href={`/inventario/ajuste?variante=${v.id}`} className="btn">
              Ajustar stock
            </Link>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Dato etiqueta="Stock" valor={v.stock} detalle={`Mínimo ${v.stockMinimo}`} />
        <Dato etiqueta="Precio" valor={euros(v.precioVenta)} />
        <Dato etiqueta="Coste medio" valor={Number(v.costeMedio) > 0 ? euros(v.costeMedio) : "—"} />
      </div>
      <h2 className="mb-2 font-semibold">Movimientos</h2>
      {movs.length === 0 ? (
        <Vacio>Sin movimientos todavía.</Vacio>
      ) : (
        <div className="tarjeta overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Detalle</th>
                <th className="text-right">Cantidad</th>
                <th className="text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {conSaldo.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap">{fechaHora(m.fecha)}</td>
                  <td>{TIPOS_MOVIMIENTO[m.tipo] ?? m.tipo}</td>
                  <td className="text-zinc-500">
                    {m.ventaId && (
                      <Link href={`/ventas/${m.ventaId}`} className="enlace">
                        Venta #{m.ventaId}
                      </Link>
                    )}
                    {m.compraId && (
                      <Link href={`/compras/${m.compraId}`} className="enlace">
                        Compra #{m.compraId}
                      </Link>
                    )}
                    {m.motivo}
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
