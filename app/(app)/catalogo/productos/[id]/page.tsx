import Link from "next/link";
import { notFound } from "next/navigation";
import { Insignia, InsigniaStock, Vacio } from "@/components/ui";
import { Foto } from "@/components/foto";
import { EditorImagen } from "@/components/editor-imagen";
import { FormAccion, BotonEnviar } from "@/components/form-accion";
import { CamposProducto, CamposVariante } from "@/components/campos-catalogo";
import {
  borrarProducto,
  crearVariante,
  descargarImagenesPendientes,
  editarProducto,
  precioParaTodos,
} from "@/lib/actions/catalogo";
import {
  imagenesPendientes,
  listarMarcas,
  listarSabores,
  obtenerProducto,
  variantesDeProducto,
  ventasPorVariante,
} from "@/lib/queries";
import { CATEGORIAS_SABOR, TIPOS_PRODUCTO, etiqueta } from "@/lib/constants";
import { euros, numero } from "@/lib/format";

export default async function Producto({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nuevo?: string; orden?: string }>;
}) {
  const id = Number((await params).id);
  const { nuevo, orden } = await searchParams;
  const producto = Number.isInteger(id) ? await obtenerProducto(id) : null;
  if (!producto) notFound();
  const [marcas, sabores, variantes, ventas, pendientes] = await Promise.all([
    listarMarcas(),
    listarSabores(),
    variantesDeProducto(id),
    ventasPorVariante(id, 30),
    imagenesPendientes(id),
  ]);

  const lista = [...variantes];
  if (orden === "stock") lista.sort((a, b) => a.stock - b.stock);
  if (orden === "ventas") lista.sort((a, b) => (ventas.get(b.id)?.unidades ?? 0) - (ventas.get(a.id)?.unidades ?? 0));

  const stockTotal = variantes.reduce((s, v) => s + Math.max(v.stock, 0), 0);
  const valorCoste = variantes.reduce((s, v) => s + Math.max(v.stock, 0) * Number(v.costeMedio), 0);
  const vendidas = [...ventas.values()].reduce((s, v) => s + v.unidades, 0);
  const facturado = [...ventas.values()].reduce((s, v) => s + Number(v.total), 0);
  const sinPrecio = variantes.filter((v) => Number(v.precioVenta) <= 0).length;
  const porReponer = variantes.filter((v) => v.activo && v.stock <= v.stockMinimo).length;
  const precios = [...new Set(variantes.map((v) => Number(v.precioVenta)).filter((p) => p > 0))];

  const caracteristicas = (producto.caracteristicas ?? "")
    .split("\n")
    .map((c) => c.trim())
    .filter(Boolean);
  if (caracteristicas.length === 0 && producto.caladas) caracteristicas.push(`${numero(producto.caladas)} caladas`);

  return (
    <>
      <Link href="/catalogo" className="mb-3 inline-block text-sm text-zinc-500 hover:text-zinc-800">
        ← Productos
      </Link>

      {/* Cabecera del producto */}
      <section className="tarjeta mb-6 grid overflow-hidden md:grid-cols-[minmax(0,340px)_1fr]">
        <Foto
          id={producto.imagenId}
          color={producto.color}
          alt={`${producto.marca} ${producto.modelo}`}
          texto={producto.marca}
          className="aspect-square w-full md:aspect-auto md:h-full md:min-h-[340px]"
        />
        <div className="flex flex-col gap-4 p-5 md:p-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-marca-700">{producto.marca}</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              {producto.marca} {producto.modelo}
            </h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Insignia tono="marca">{etiqueta(TIPOS_PRODUCTO, producto.tipo)}</Insignia>
              {producto.ml && <Insignia>{Number(producto.ml)} ml</Insignia>}
              {!producto.activo && <Insignia tono="rojo">Inactivo</Insignia>}
            </div>
          </div>
          {producto.descripcion && <p className="text-[15px] leading-relaxed text-zinc-600">{producto.descripcion}</p>}
          {caracteristicas.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {caracteristicas.map((c) => (
                <li key={c} className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-sm text-zinc-700">
                  {c}
                </li>
              ))}
            </ul>
          )}
          <dl className="grid grid-cols-2 gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">Sabores</dt>
              <dd className="text-xl font-semibold tabular-nums">{variantes.length}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">En stock</dt>
              <dd className="text-xl font-semibold tabular-nums">{stockTotal} uds.</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">Valor a coste</dt>
              <dd className="text-xl font-semibold tabular-nums">{euros(valorCoste)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">Vendidas 30 días</dt>
              <dd className="text-xl font-semibold tabular-nums">
                {vendidas} <span className="text-sm font-normal text-zinc-500">· {euros(facturado)}</span>
              </dd>
            </div>
          </dl>
          <div className="text-sm text-zinc-500">
            PVP:{" "}
            {precios.length === 0
              ? "sin precio"
              : precios.length === 1
                ? euros(precios[0])
                : `${euros(Math.min(...precios))} – ${euros(Math.max(...precios))}`}
            {porReponer > 0 && (
              <>
                {" · "}
                <span className="font-medium text-amber-700">{porReponer} sabores por reponer</span>
              </>
            )}
          </div>
        </div>
      </section>

      {sinPrecio > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {sinPrecio === variantes.length ? "Ningún sabor tiene" : `${sinPrecio} sabores no tienen`} precio de venta todavía. Pónselo
          aquí debajo para poder venderlos.
        </div>
      )}

      {/* Acciones rápidas para todo el producto */}
      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <FormAccion accion={precioParaTodos} className="tarjeta p-4">
          <input type="hidden" name="producto_id" value={producto.id} />
          <h2 className="mb-3 font-semibold">Aplicar a todos los sabores</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="etiqueta" htmlFor="precio_todos">
                Precio de venta (€)
              </label>
              <input id="precio_todos" name="precio_venta" inputMode="decimal" className="campo" placeholder="p. ej. 15" />
            </div>
            <div>
              <label className="etiqueta" htmlFor="minimo_todos">
                Avisar cuando queden
              </label>
              <input id="minimo_todos" name="stock_minimo" type="number" min={0} inputMode="numeric" className="campo" placeholder="p. ej. 3" />
            </div>
          </div>
          <div className="mt-3">
            <BotonEnviar className="btn-sec">Aplicar a los {variantes.length} sabores</BotonEnviar>
          </div>
        </FormAccion>
        <div className="tarjeta flex flex-col justify-between gap-3 p-4">
          <div>
            <h2 className="font-semibold">Movimientos de stock</h2>
            <p className="mt-1 text-sm text-zinc-500">El stock entra con las compras y sale con las ventas. Para corregirlo, usa un ajuste.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/compras/nueva" className="btn">
              Registrar compra
            </Link>
            <Link href={`/inventario?q=${encodeURIComponent(producto.modelo)}`} className="btn-sec">
              Ver en inventario
            </Link>
          </div>
          {pendientes > 0 && (
            <FormAccion accion={descargarImagenesPendientes}>
              <input type="hidden" name="producto_id" value={producto.id} />
              <BotonEnviar className="btn-sec w-full" textoPendiente="Descargando…">
                Descargar imágenes en alta ({pendientes})
              </BotonEnviar>
            </FormAccion>
          )}
        </div>
      </section>

      {/* Sabores */}
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-lg font-semibold">Sabores</h2>
        <div className="flex gap-1 text-sm">
          {[
            { v: undefined, t: "A–Z" },
            { v: "stock", t: "Menos stock" },
            { v: "ventas", t: "Más vendidos" },
          ].map((o) => (
            <Link
              key={o.t}
              href={o.v ? `/catalogo/productos/${producto.id}?orden=${o.v}` : `/catalogo/productos/${producto.id}`}
              className={`rounded-full px-3 py-1 ${orden === o.v ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100"}`}
            >
              {o.t}
            </Link>
          ))}
        </div>
      </div>
      {lista.length === 0 ? (
        <Vacio>{nuevo ? "Producto creado. Añade sus sabores aquí debajo." : "Sin sabores todavía."}</Vacio>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {lista.map((v) => {
            const vend = ventas.get(v.id)?.unidades ?? 0;
            return (
              <li key={v.id}>
                <Link
                  href={`/catalogo/variantes/${v.id}`}
                  className={`tarjeta group flex h-full flex-col overflow-hidden transition hover:border-marca-200 hover:shadow-sm ${v.activo ? "" : "opacity-50"}`}
                >
                  <div className="relative">
                    <Foto
                      id={v.imagenPropiaId}
                      color={v.color}
                      alt={`${v.marca} ${v.modelo} ${v.sabor}`}
                      texto={v.sabor}
                      className="aspect-square w-full transition group-hover:scale-[1.02]"
                    />
                    <span className="absolute right-2 top-2">
                      <InsigniaStock stock={v.stock} minimo={v.stockMinimo} />
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <div className="font-medium leading-tight">{v.sabor}</div>
                    {v.descripcionSabor && <div className="line-clamp-2 text-xs text-zinc-500">{v.descripcionSabor}</div>}
                    <div className="mt-auto flex items-end justify-between pt-2">
                      <span className="text-xs text-zinc-500">
                        {etiqueta(CATEGORIAS_SABOR, v.categoria)} · {v.nicotinaMg} mg
                        <br />
                        {vend > 0 ? `${vend} vendidas (30 d)` : "sin ventas (30 d)"}
                      </span>
                      <span className={`font-semibold tabular-nums ${Number(v.precioVenta) > 0 ? "" : "text-amber-700"}`}>
                        {Number(v.precioVenta) > 0 ? euros(v.precioVenta) : "sin precio"}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <details className="tarjeta mt-6" open={variantes.length === 0 || Boolean(nuevo)}>
        <summary className="cursor-pointer px-4 py-3 font-semibold">Añadir sabor</summary>
        <div className="border-t border-zinc-200 p-4">
          <FormAccion accion={crearVariante} limpiarAlGuardar>
            <input type="hidden" name="producto_id" value={producto.id} />
            <CamposVariante sabores={sabores} />
            <div className="mt-4">
              <BotonEnviar>Añadir sabor</BotonEnviar>
            </div>
          </FormAccion>
        </div>
      </details>

      <details className="tarjeta mt-4">
        <summary className="cursor-pointer px-4 py-3 font-semibold">Imagen del producto</summary>
        <div className="border-t border-zinc-200 p-4">
          <EditorImagen destino="producto" id={producto.id} tieneImagen={Boolean(producto.imagenId)} />
        </div>
      </details>

      <details className="tarjeta mt-4">
        <summary className="cursor-pointer px-4 py-3 font-semibold">Datos del producto</summary>
        <div className="border-t border-zinc-200 p-4">
          <FormAccion accion={editarProducto}>
            <input type="hidden" name="id" value={producto.id} />
            <CamposProducto marcas={marcas} valores={producto} />
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input type="checkbox" name="activo" defaultChecked={producto.activo} className="h-4 w-4" />
              Activo (desmárcalo si dejas de venderlo; el historial se conserva)
            </label>
            <div className="mt-4">
              <BotonEnviar>Guardar cambios</BotonEnviar>
            </div>
          </FormAccion>
          {variantes.length === 0 && (
            <FormAccion accion={borrarProducto} className="mt-6 border-t border-zinc-200 pt-4">
              <input type="hidden" name="id" value={producto.id} />
              <BotonEnviar className="btn-peligro" textoPendiente="Borrando…">
                Borrar producto
              </BotonEnviar>
            </FormAccion>
          )}
        </div>
      </details>
    </>
  );
}
