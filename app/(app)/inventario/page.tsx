import Link from "next/link";
import { Cabecera, Dato, InsigniaStock, Vacio } from "@/components/ui";
import { Foto } from "@/components/foto";
import { listarMarcas, listarVariantes } from "@/lib/queries";
import { CATEGORIAS_SABOR, TIPOS_PRODUCTO } from "@/lib/constants";
import { euros } from "@/lib/format";

export default async function Inventario({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; marca?: string; tipo?: string; cat?: string; bajo?: string; inactivos?: string }>;
}) {
  const sp = await searchParams;
  const [variantes, marcas] = await Promise.all([
    listarVariantes({
      q: sp.q?.trim() || undefined,
      marcaId: sp.marca ? Number(sp.marca) : undefined,
      tipo: sp.tipo || undefined,
      categoria: sp.cat || undefined,
      soloBajo: sp.bajo === "1",
      incluirInactivos: sp.inactivos === "1",
    }),
    listarMarcas(),
  ]);
  const unidades = variantes.reduce((s, v) => s + Math.max(v.stock, 0), 0);
  const valorCoste = variantes.reduce((s, v) => s + Math.max(v.stock, 0) * Number(v.costeMedio), 0);
  const valorVenta = variantes.reduce((s, v) => s + Math.max(v.stock, 0) * Number(v.precioVenta), 0);
  const hayFiltros = Boolean(sp.q || sp.marca || sp.tipo || sp.cat || sp.bajo || sp.inactivos);

  return (
    <>
      <Cabecera
        titulo="Inventario"
        acciones={
          <Link href="/inventario/ajuste" className="btn-sec">
            Ajustar stock
          </Link>
        }
      />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Dato etiqueta="Unidades" valor={unidades} />
        <Dato etiqueta="Valor a coste" valor={euros(valorCoste)} detalle="Lo que te costó" />
        <Dato etiqueta="Valor a PVP" valor={euros(valorVenta)} detalle="Si lo vendes todo" />
      </div>

      <form className="tarjeta mb-5 grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-6" action="/inventario">
        <input name="q" defaultValue={sp.q} placeholder="Buscar…" className="campo lg:col-span-2" aria-label="Buscar" />
        <select name="marca" defaultValue={sp.marca ?? ""} className="campo" aria-label="Marca">
          <option value="">Todas las marcas</option>
          {marcas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>
        <select name="tipo" defaultValue={sp.tipo ?? ""} className="campo" aria-label="Tipo">
          <option value="">Todos los tipos</option>
          {TIPOS_PRODUCTO.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select name="cat" defaultValue={sp.cat ?? ""} className="campo" aria-label="Categoría de sabor">
          <option value="">Todas las categorías</option>
          {CATEGORIAS_SABOR.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <button className="btn flex-1">Filtrar</button>
          {hayFiltros && (
            <Link href="/inventario" className="btn-sec">
              ✕
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-zinc-600 sm:col-span-2 lg:col-span-6">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="bajo" value="1" defaultChecked={sp.bajo === "1"} className="h-4 w-4" /> Solo por reponer
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="inactivos" value="1" defaultChecked={sp.inactivos === "1"} className="h-4 w-4" /> Incluir inactivos
          </label>
        </div>
      </form>

      {variantes.length === 0 ? (
        <Vacio>{hayFiltros ? "Nada coincide con los filtros." : "No hay productos en el catálogo."}</Vacio>
      ) : (
        <div className="tarjeta overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Producto</th>
                <th className="text-right">Nic.</th>
                <th className="text-right">PVP</th>
                <th className="text-right">Coste</th>
                <th className="text-right">Mín.</th>
                <th className="text-right">Stock</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {variantes.map((v) => (
                <tr key={v.id} className={v.activo ? "" : "opacity-50"}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Foto id={v.imagenId} color={v.color} alt="" texto={v.sabor} className="h-10 w-10 shrink-0 rounded-md" />
                      <div>
                        <Link href={`/inventario/${v.id}`} className="font-medium hover:underline">
                          {v.sabor}
                        </Link>
                        <div className="text-xs text-zinc-500">
                          {v.marca} {v.modelo}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="text-right tabular-nums">{v.nicotinaMg}</td>
                  <td className={`text-right tabular-nums ${Number(v.precioVenta) > 0 ? "" : "text-amber-700"}`}>
                    {Number(v.precioVenta) > 0 ? euros(v.precioVenta) : "—"}
                  </td>
                  <td className="text-right tabular-nums text-zinc-500">{Number(v.costeMedio) > 0 ? euros(v.costeMedio) : "—"}</td>
                  <td className="text-right tabular-nums text-zinc-500">{v.stockMinimo}</td>
                  <td className="text-right">
                    <InsigniaStock stock={v.stock} minimo={v.stockMinimo} />
                  </td>
                  <td className="text-right">
                    <Link href={`/inventario/ajuste?variante=${v.id}`} className="enlace text-sm">
                      Ajustar
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
