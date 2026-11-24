import Link from "next/link";
import { Cabecera, Insignia, Vacio } from "@/components/ui";
import { Foto } from "@/components/foto";
import { listarProductos } from "@/lib/queries";
import { TIPOS_PRODUCTO, etiqueta } from "@/lib/constants";
import { traductor } from "@/lib/i18n/servidor";

export default async function Productos() {
  const t = await traductor();
  const productos = await listarProductos();
  const porMarca = new Map<string, typeof productos>();
  for (const p of productos) porMarca.set(p.marca, [...(porMarca.get(p.marca) ?? []), p]);

  return (
    <>
      <Cabecera
        titulo={t("Productos")}
        subtitulo={t("Cada producto (marca + modelo) tiene sus sabores, y cada sabor su precio y su stock.")}
        acciones={
          <Link href="/catalogo/productos/nuevo" className="btn">
            {t("Nuevo producto")}
          </Link>
        }
      />
      {productos.length === 0 ? (
        <Vacio>
          {t("Todavía no hay productos.")}{" "}
          <Link href="/catalogo/productos/nuevo" className="enlace">
            {t("Crea el primero")}
          </Link>
          .
        </Vacio>
      ) : (
        <div className="space-y-5">
          {[...porMarca].map(([marca, lista]) => (
            <section key={marca} className="tarjeta overflow-hidden">
              <h2 className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold">{marca}</h2>
              <ul className="divide-y divide-zinc-100">
                {lista.map((p) => (
                  <li key={p.id}>
                    <Link href={`/catalogo/productos/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50">
                      <Foto id={p.imagenId} color={p.color} alt={p.modelo} texto={`${p.marca} ${p.modelo}`} className="h-14 w-14 shrink-0 rounded-lg" ajuste="cover" />
                      <div className="flex-1">
                        <div className="font-medium">
                          {p.modelo} {!p.activo && <Insignia>{t("Inactivo")}</Insignia>}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {t(etiqueta(TIPOS_PRODUCTO, p.tipo))}
                          {p.caladas ? ` · ${t("{n} caladas", { n: p.caladas })}` : ""}
                          {p.ml ? ` · ${Number(p.ml)} ml` : ""}
                        </div>
                      </div>
                      <div className="text-right text-sm text-zinc-500">
                        <div>{p.variantes === 1 ? t("1 sabor") : t("{n} sabores", { n: p.variantes })}</div>
                        <div className="text-xs">{t("{n} uds. en stock", { n: p.stock })}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
