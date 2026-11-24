import Link from "next/link";
import { Cabecera, Dato, InsigniaStock, Vacio } from "@/components/ui";
import { Foto } from "@/components/foto";
import { listarMarcas, listarVariantes } from "@/lib/queries";
import { CATEGORIAS_SABOR, TIPOS_PRODUCTO } from "@/lib/constants";
import { euros } from "@/lib/format";
import { traductor } from "@/lib/i18n/servidor";

export default async function Inventario({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; marca?: string; tipo?: string; cat?: string; bajo?: string; inactivos?: string }>;
}) {
  const t = await traductor();
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
        titulo={t("Inventario")}
        acciones={
          <Link href="/inventario/ajuste" className="btn-sec">
            {t("Ajustar stock")}
          </Link>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 [&>:last-child]:col-span-2 sm:[&>:last-child]:col-span-1">
        <Dato etiqueta={t("Unidades")} valor={unidades} />
        <Dato etiqueta={t("Valor a coste")} valor={euros(valorCoste)} detalle={t("Lo que te costó")} />
        <Dato etiqueta={t("Valor a PVP")} valor={euros(valorVenta)} detalle={t("Si lo vendes todo")} />
      </div>

      <form className="tarjeta mb-5 grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-6" action="/inventario">
        <input name="q" defaultValue={sp.q} placeholder={t("Buscar…")} className="campo lg:col-span-2" aria-label={t("Buscar")} />
        <select name="marca" defaultValue={sp.marca ?? ""} className="campo" aria-label={t("Marca")}>
          <option value="">{t("Todas las marcas")}</option>
          {marcas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>
        <select name="tipo" defaultValue={sp.tipo ?? ""} className="campo" aria-label={t("Tipo")}>
          <option value="">{t("Todos los tipos")}</option>
          {TIPOS_PRODUCTO.map((x) => (
            <option key={x.value} value={x.value}>
              {t(x.label)}
            </option>
          ))}
        </select>
        <select name="cat" defaultValue={sp.cat ?? ""} className="campo" aria-label={t("Categoría de sabor")}>
          <option value="">{t("Todas las categorías")}</option>
          {CATEGORIAS_SABOR.map((c) => (
            <option key={c.value} value={c.value}>
              {t(c.label)}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <button className="btn flex-1">{t("Filtrar")}</button>
          {hayFiltros && (
            <Link href="/inventario" className="btn-sec">
              ✕
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-zinc-600 sm:col-span-2 lg:col-span-6">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="bajo" value="1" defaultChecked={sp.bajo === "1"} className="h-4 w-4" /> {t("Solo por reponer")}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="inactivos" value="1" defaultChecked={sp.inactivos === "1"} className="h-4 w-4" /> {t("Incluir inactivos")}
          </label>
        </div>
      </form>

      {variantes.length === 0 ? (
        <Vacio>{hayFiltros ? t("Nada coincide con los filtros.") : t("No hay productos en el catálogo.")}</Vacio>
      ) : (
        <div className="tarjeta overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>{t("Producto")}</th>
                <th className="text-right">{t("Nic.")}</th>
                <th className="text-right">{t("PVP")}</th>
                <th className="text-right">{t("Coste")}</th>
                <th className="text-right">{t("Mín.")}</th>
                <th className="text-right">{t("Stock")}</th>
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
                      {t("Ajustar")}
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
