import Link from "next/link";
import { Cabecera, Dato, InsigniaStock, Vacio } from "@/components/ui";
import { Foto } from "@/components/foto";
import { listarVariantes, resumenPeriodo, topSabores } from "@/lib/queries";
import { estadoCaja } from "@/lib/caja";
import { euros, fecha } from "@/lib/format";

export default async function Inicio() {
  const [hoy, semana, mes, top, variantes, caja] = await Promise.all([
    resumenPeriodo(1),
    resumenPeriodo(7),
    resumenPeriodo(30),
    topSabores(30),
    listarVariantes(),
    estadoCaja(),
  ]);
  const bajos = variantes
    .filter((v) => v.stock <= v.stockMinimo && (v.stockMinimo > 0 || v.stock <= 0))
    .sort((a, b) => a.stock - b.stock);
  const sinCatalogo = variantes.length === 0;
  const sinPrecio = variantes.filter((v) => Number(v.precioVenta) <= 0);

  return (
    <>
      <Cabecera
        titulo="Inicio"
        acciones={
          <>
            <Link href="/compras/nueva" className="btn-sec">
              Registrar compra
            </Link>
            <Link href="/ventas/nueva" className="btn">
              Nueva venta
            </Link>
          </>
        }
      />

      {sinCatalogo && (
        <div className="tarjeta mb-6 border-marca-200 bg-marca-50 p-5">
          <h2 className="font-semibold text-marca-900">Para empezar</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-marca-900">
            <li>
              Crea tus productos en <Link href="/catalogo/productos/nuevo" className="enlace">Catálogo → Nuevo producto</Link> (marca y modelo) y
              añádeles sus sabores con el precio de venta.
            </li>
            <li>
              Registra la <Link href="/compras/nueva" className="enlace">compra</Link> de lo que tienes: así entra el stock y se calcula tu coste.
            </li>
            <li>
              Ya puedes <Link href="/ventas/nueva" className="enlace">vender</Link>.
            </li>
          </ol>
        </div>
      )}

      {caja.pendienteDeOtroDia && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>La caja está sin cerrar desde el {fecha(caja.periodo.desde)}.</span>
          <Link href="/caja" className="font-medium underline">
            Cerrar caja
          </Link>
        </div>
      )}

      {sinPrecio.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>
            {sinPrecio.length} sabores no tienen precio de venta y no se pueden vender todavía.
          </span>
          <Link href={`/catalogo/productos/${sinPrecio[0].productoId}`} className="font-medium underline">
            Poner precios
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato etiqueta="Ventas hoy" valor={euros(hoy.total)} detalle={`${hoy.ventas} tickets · ${hoy.unidades} uds.`} />
        <Dato etiqueta="Beneficio hoy" valor={euros(hoy.beneficio)} detalle="Ventas menos coste" />
        <Dato etiqueta="Últimos 7 días" valor={euros(semana.total)} detalle={`Beneficio ${euros(semana.beneficio)}`} />
        <Dato etiqueta="Últimos 30 días" valor={euros(mes.total)} detalle={`Beneficio ${euros(mes.beneficio)}`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="tarjeta overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
            <h2 className="font-semibold">Reponer</h2>
            <Link href="/inventario?bajo=1" className="text-sm enlace">
              Ver todo
            </Link>
          </div>
          {bajos.length === 0 ? (
            <p className="px-4 py-6 text-sm text-zinc-500">Nada por debajo del mínimo.</p>
          ) : (
            <table className="tabla">
              <tbody>
                {bajos.slice(0, 10).map((v) => (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/inventario/${v.id}`} className="flex items-center gap-3">
                        <Foto id={v.imagenId} color={v.color} alt="" texto={v.sabor} className="h-9 w-9 shrink-0 rounded-md" />
                        <span>
                          <span className="block font-medium">{v.sabor}</span>
                          <span className="block text-xs text-zinc-500">
                            {v.marca} {v.modelo} · {v.nicotinaMg} mg
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="text-right text-xs text-zinc-500">mín. {v.stockMinimo}</td>
                    <td className="w-12 text-right">
                      <InsigniaStock stock={v.stock} minimo={v.stockMinimo} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="tarjeta overflow-hidden">
          <div className="border-b border-zinc-200 px-4 py-3">
            <h2 className="font-semibold">Sabores más vendidos · 30 días</h2>
          </div>
          {top.length === 0 ? (
            <div className="p-4">
              <Vacio>Aún no hay ventas.</Vacio>
            </div>
          ) : (
            <table className="tabla">
              <tbody>
                {top.map((t, i) => (
                  <tr key={t.sabor}>
                    <td className="w-8 text-zinc-400 tabular-nums">{i + 1}</td>
                    <td className="font-medium">{t.sabor}</td>
                    <td className="text-right tabular-nums text-zinc-500">{t.unidades} uds.</td>
                    <td className="text-right tabular-nums">{euros(t.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
