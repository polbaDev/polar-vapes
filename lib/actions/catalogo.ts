"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { marcas, sabores, proveedores, productos, variantes } from "@/lib/db/schema";
import { borrarSiHuerfana, guardarImagen, importarImagenDesdeUrl } from "@/lib/imagenes";
import { exigirSesion } from "@/lib/session";
import { tx } from "@/lib/i18n";
import { traductor } from "@/lib/i18n/servidor";
import { CATEGORIAS_SABOR, TIPOS_PRODUCTO, valores } from "@/lib/constants";
import { type Resultado, texto, textoONulo, entero, decimal, mensajeError } from "./tipos";

function refrescarCatalogo() {
  revalidatePath("/catalogo", "layout");
  revalidatePath("/inventario");
  revalidatePath("/ventas/nueva");
  revalidatePath("/compras/nueva");
}

// ---------- Marcas ----------

export async function crearMarca(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const t = await traductor();
  const nombre = texto(fd, "nombre");
  if (!nombre) return { error: t("Escribe el nombre de la marca.") };
  try {
    await db.insert(marcas).values({ nombre });
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescarCatalogo();
  return { ok: t('Marca "{nombre}" creada.', { nombre }) };
}

export async function editarMarca(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const t = await traductor();
  const id = entero(fd, "id");
  const nombre = texto(fd, "nombre");
  if (!id || !nombre) return { error: t("Falta el nombre.") };
  try {
    await db.update(marcas).set({ nombre }).where(eq(marcas.id, id));
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescarCatalogo();
  return { ok: t("Guardado.") };
}

export async function borrarMarca(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const t = await traductor();
  const id = entero(fd, "id");
  if (!id) return { error: t("Marca no válida.") };
  try {
    await db.delete(marcas).where(eq(marcas.id, id));
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescarCatalogo();
  return { ok: t("Marca borrada.") };
}

// ---------- Sabores ----------

function categoriaValida(c: string) {
  return valores(CATEGORIAS_SABOR).includes(c) ? c : "otro";
}

export async function crearSabor(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const t = await traductor();
  const nombre = texto(fd, "nombre");
  if (!nombre) return { error: t("Escribe el nombre del sabor.") };
  try {
    await db
      .insert(sabores)
      .values({ nombre, categoria: categoriaValida(texto(fd, "categoria")), descripcion: textoONulo(fd, "descripcion") });
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescarCatalogo();
  return { ok: t('Sabor "{nombre}" creado.', { nombre }) };
}

export async function editarSabor(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const t = await traductor();
  const id = entero(fd, "id");
  const nombre = texto(fd, "nombre");
  if (!id || !nombre) return { error: t("Falta el nombre.") };
  try {
    await db
      .update(sabores)
      .set({ nombre, categoria: categoriaValida(texto(fd, "categoria")), descripcion: textoONulo(fd, "descripcion") })
      .where(eq(sabores.id, id));
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescarCatalogo();
  return { ok: t("Guardado.") };
}

export async function borrarSabor(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const t = await traductor();
  const id = entero(fd, "id");
  if (!id) return { error: t("Sabor no válido.") };
  try {
    await db.delete(sabores).where(eq(sabores.id, id));
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescarCatalogo();
  return { ok: t("Sabor borrado.") };
}

// ---------- Proveedores ----------

export async function crearProveedor(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const t = await traductor();
  const nombre = texto(fd, "nombre");
  if (!nombre) return { error: t("Escribe el nombre del proveedor.") };
  try {
    await db.insert(proveedores).values({
      nombre,
      telefono: textoONulo(fd, "telefono"),
      email: textoONulo(fd, "email"),
      notas: textoONulo(fd, "notas"),
    });
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescarCatalogo();
  return { ok: t('Proveedor "{nombre}" creado.', { nombre }) };
}

export async function editarProveedor(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const t = await traductor();
  const id = entero(fd, "id");
  const nombre = texto(fd, "nombre");
  if (!id || !nombre) return { error: t("Falta el nombre.") };
  try {
    await db
      .update(proveedores)
      .set({
        nombre,
        telefono: textoONulo(fd, "telefono"),
        email: textoONulo(fd, "email"),
        notas: textoONulo(fd, "notas"),
      })
      .where(eq(proveedores.id, id));
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescarCatalogo();
  return { ok: t("Guardado.") };
}

export async function borrarProveedor(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const t = await traductor();
  const id = entero(fd, "id");
  if (!id) return { error: t("Proveedor no válido.") };
  try {
    await db.delete(proveedores).where(eq(proveedores.id, id));
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescarCatalogo();
  return { ok: t("Proveedor borrado.") };
}

// ---------- Productos ----------

async function marcaDesdeForm(fd: FormData): Promise<number> {
  // Se puede elegir una marca existente o escribir una nueva
  const nueva = texto(fd, "marca_nueva");
  if (nueva) {
    const [existente] = await db.select().from(marcas).where(sql`lower(${marcas.nombre}) = lower(${nueva})`);
    if (existente) return existente.id;
    const [m] = await db.insert(marcas).values({ nombre: nueva }).returning({ id: marcas.id });
    return m.id;
  }
  const id = entero(fd, "marca_id");
  if (!id) throw new Error(tx("Elige una marca o escribe una nueva."));
  return id;
}

function datosProducto(fd: FormData) {
  const modelo = texto(fd, "modelo");
  if (!modelo) throw new Error(tx("Escribe el modelo."));
  const tipo = texto(fd, "tipo");
  const caladas = entero(fd, "caladas");
  const ml = decimal(fd, "ml");
  if (Number.isNaN(caladas) || (caladas !== null && caladas < 0)) throw new Error(tx("Caladas no válidas."));
  if (Number.isNaN(ml) || (ml !== null && ml < 0)) throw new Error(tx("Mililitros no válidos."));
  return {
    modelo,
    tipo: valores(TIPOS_PRODUCTO).includes(tipo) ? tipo : "otro",
    caladas,
    ml: ml === null ? null : String(ml),
    descripcion: textoONulo(fd, "descripcion"),
    caracteristicas: textoONulo(fd, "caracteristicas"),
  };
}

export async function crearProducto(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const t = await traductor();
  let id: number;
  try {
    const datos = datosProducto(fd);
    const marcaId = await marcaDesdeForm(fd);
    const [p] = await db.insert(productos).values({ ...datos, marcaId }).returning({ id: productos.id });
    id = p.id;
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescarCatalogo();
  redirect(`/catalogo/productos/${id}?nuevo=1`);
}

export async function editarProducto(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const t = await traductor();
  const id = entero(fd, "id");
  if (!id) return { error: t("Producto no válido.") };
  try {
    const datos = datosProducto(fd);
    const marcaId = await marcaDesdeForm(fd);
    await db
      .update(productos)
      .set({ ...datos, marcaId, activo: fd.get("activo") === "on" })
      .where(eq(productos.id, id));
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescarCatalogo();
  return { ok: t("Producto guardado.") };
}

export async function borrarProducto(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const t = await traductor();
  const id = entero(fd, "id");
  if (!id) return { error: t("Producto no válido.") };
  try {
    await db.delete(productos).where(eq(productos.id, id));
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescarCatalogo();
  redirect("/catalogo");
}

// ---------- Variantes (sabor + nicotina de un producto) ----------

async function saborDesdeForm(fd: FormData): Promise<number> {
  const nombre = texto(fd, "sabor");
  if (!nombre) throw new Error(tx("Escribe o elige un sabor."));
  const [existente] = await db.select().from(sabores).where(sql`lower(${sabores.nombre}) = lower(${nombre})`);
  if (existente) return existente.id;
  const [s] = await db
    .insert(sabores)
    .values({ nombre, categoria: categoriaValida(texto(fd, "categoria")) })
    .returning({ id: sabores.id });
  return s.id;
}

function datosVariante(fd: FormData) {
  const nicotina = entero(fd, "nicotina_mg") ?? 0;
  const precio = decimal(fd, "precio_venta");
  const minimo = entero(fd, "stock_minimo") ?? 0;
  if (Number.isNaN(nicotina) || nicotina < 0) throw new Error(tx("Nicotina no válida (número entero de mg)."));
  if (precio === null || Number.isNaN(precio) || precio < 0) throw new Error(tx("Pon el precio de venta."));
  if (Number.isNaN(minimo) || minimo < 0) throw new Error(tx("Stock mínimo no válido."));
  return {
    nicotinaMg: nicotina,
    precioVenta: precio.toFixed(2),
    stockMinimo: minimo,
    codigoBarras: textoONulo(fd, "codigo_barras"),
  };
}

export async function crearVariante(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const t = await traductor();
  const productoId = entero(fd, "producto_id");
  if (!productoId) return { error: t("Producto no válido.") };
  try {
    const datos = datosVariante(fd);
    const saborId = await saborDesdeForm(fd);
    await db.insert(variantes).values({ ...datos, productoId, saborId });
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescarCatalogo();
  return { ok: t("Sabor añadido al producto.") };
}

export async function editarVariante(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const t = await traductor();
  const id = entero(fd, "id");
  if (!id) return { error: t("Variante no válida.") };
  try {
    const datos = datosVariante(fd);
    const saborId = await saborDesdeForm(fd);
    await db
      .update(variantes)
      .set({ ...datos, saborId, activo: fd.get("activo") === "on" })
      .where(eq(variantes.id, id));
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescarCatalogo();
  return { ok: t("Guardado.") };
}

export async function borrarVariante(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const t = await traductor();
  const id = entero(fd, "id");
  const productoId = entero(fd, "producto_id");
  if (!id) return { error: t("Variante no válida.") };
  try {
    await db.delete(variantes).where(eq(variantes.id, id));
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescarCatalogo();
  redirect(productoId ? `/catalogo/productos/${productoId}` : "/catalogo");
}

// ---------- Precio para todos los sabores de un producto ----------

export async function precioParaTodos(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const t = await traductor();
  const productoId = entero(fd, "producto_id");
  const precio = decimal(fd, "precio_venta");
  const minimo = entero(fd, "stock_minimo");
  if (!productoId) return { error: t("Producto no válido.") };
  if (precio === null && minimo === null) return { error: t("Escribe un precio o un stock mínimo.") };
  if (precio !== null && (Number.isNaN(precio) || precio < 0)) return { error: t("Precio no válido.") };
  if (minimo !== null && (Number.isNaN(minimo) || minimo < 0)) return { error: t("Stock mínimo no válido.") };
  const cambios: { precioVenta?: string; stockMinimo?: number } = {};
  if (precio !== null) cambios.precioVenta = precio.toFixed(2);
  if (minimo !== null) cambios.stockMinimo = minimo;
  const filas = await db.update(variantes).set(cambios).where(eq(variantes.productoId, productoId)).returning({ id: variantes.id });
  refrescarCatalogo();
  return { ok: filas.length === 1 ? t("Actualizado 1 sabor.") : t("Actualizados {n} sabores.", { n: filas.length }) };
}

// ---------- Imágenes ----------

type Destino = "producto" | "variante";

async function imagenActual(destino: Destino, id: number) {
  const tabla = destino === "producto" ? productos : variantes;
  const [fila] = await db.select({ imagenId: tabla.imagenId }).from(tabla).where(eq(tabla.id, id));
  if (!fila) throw new Error(tx("No existe."));
  return fila.imagenId;
}

async function asignarImagen(destino: Destino, id: number, imagenId: number | null, fuente?: string | null) {
  const tabla = destino === "producto" ? productos : variantes;
  const anterior = await imagenActual(destino, id);
  const cambios: { imagenId: number | null; imagenFuente?: string | null } = { imagenId };
  if (fuente !== undefined) cambios.imagenFuente = fuente;
  await db.update(tabla).set(cambios).where(eq(tabla.id, id));
  if (anterior && anterior !== imagenId) await borrarSiHuerfana(anterior);
}

export async function cambiarImagen(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const t = await traductor();
  const destino = texto(fd, "destino") as Destino;
  const id = entero(fd, "id");
  if (!id || !["producto", "variante"].includes(destino)) return { error: t("Destino no válido.") };
  try {
    if (fd.get("quitar") === "1") {
      await asignarImagen(destino, id, null, null);
      refrescarCatalogo();
      return { ok: t("Imagen quitada.") };
    }
    const archivo = fd.get("archivo");
    const url = texto(fd, "url");
    let nueva: number;
    if (archivo instanceof File && archivo.size > 0) {
      if (!archivo.type.startsWith("image/")) throw new Error(tx("El archivo no es una imagen."));
      nueva = await guardarImagen(Buffer.from(await archivo.arrayBuffer()), "subida");
      // Tu foto manda: ya no se intentará sustituir por la de internet
      await asignarImagen(destino, id, nueva, null);
    } else if (url) {
      nueva = await importarImagenDesdeUrl(url, t);
      await asignarImagen(destino, id, nueva, url);
    } else {
      throw new Error(tx("Elige una foto o pega un enlace."));
    }
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescarCatalogo();
  return { ok: t("Imagen guardada.") };
}

// Vuelve a intentar descargar las imágenes "buenas" (imagen_fuente) que falten o que sean de respaldo
export async function descargarImagenesPendientes(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const t = await traductor();
  const productoId = entero(fd, "producto_id");
  if (!productoId) return { error: t("Producto no válido.") };
  const pendientes = (await db.execute(sql`
    select 'producto' as destino, p.id, p.imagen_fuente as fuente
    from productos p left join imagenes i on i.id = p.imagen_id
    where p.id = ${productoId} and p.imagen_fuente is not null and (i.id is null or i.origen is distinct from p.imagen_fuente)
    union all
    select 'variante', v.id, v.imagen_fuente
    from variantes v left join imagenes i on i.id = v.imagen_id
    where v.producto_id = ${productoId} and v.imagen_fuente is not null and (i.id is null or i.origen is distinct from v.imagen_fuente)
  `)) as unknown as { destino: Destino; id: number; fuente: string }[];
  if (pendientes.length === 0) return { ok: t("Todas las imágenes ya están descargadas.") };
  let bien = 0;
  const fallos: string[] = [];
  for (const p of pendientes) {
    try {
      const nueva = await importarImagenDesdeUrl(p.fuente, t);
      await asignarImagen(p.destino, p.id, nueva);
      bien++;
    } catch (e) {
      fallos.push(e instanceof Error ? t(e.message) : String(e));
    }
  }
  refrescarCatalogo();
  if (fallos.length === 0) return { ok: bien === 1 ? t("Descargada 1 imagen.") : t("Descargadas {n} imágenes.", { n: bien }) };
  return {
    error: t("Descargadas {bien} de {total}. Fallaron {fallos} ({motivo}). ¿Hay internet? Puedes subirlas a mano.", {
      bien,
      total: pendientes.length,
      fallos: fallos.length,
      motivo: fallos[0],
    }),
  };
}

