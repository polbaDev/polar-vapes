import "server-only";
import sharp from "sharp";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { imagenes } from "@/lib/db/schema";
import { tEs, tx, type T } from "@/lib/i18n";

const MAX_LADO = 900; // px: suficiente para la ficha y ligero para el móvil
const MAX_BYTES = 15 * 1024 * 1024;

// Redimensiona, convierte a WebP y calcula el color dominante
export async function procesarImagen(entrada: Buffer) {
  const img = sharp(entrada, { failOn: "none" }).rotate();
  const datos = await img
    .resize({ width: MAX_LADO, height: MAX_LADO, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84 })
    .toBuffer({ resolveWithObject: true });
  const { dominant } = await sharp(datos.data).stats();
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return {
    datos: datos.data,
    ancho: datos.info.width,
    alto: datos.info.height,
    color: `#${hex(dominant.r)}${hex(dominant.g)}${hex(dominant.b)}`,
  };
}

export async function guardarImagen(entrada: Buffer, origen: string) {
  const p = await procesarImagen(entrada);
  const [fila] = await db
    .insert(imagenes)
    .values({ tipo: "image/webp", datos: p.datos, ancho: p.ancho, alto: p.alto, color: p.color, origen })
    .returning({ id: imagenes.id });
  return fila.id;
}

// Los errores salen en el idioma de `t` (los fijos van marcados con tx y los traduce mensajeError)
export async function descargarImagen(url: string, t: T = tEs): Promise<Buffer> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error(tx("El enlace no es válido."));
  }
  if (!["http:", "https:"].includes(u.protocol)) throw new Error(tx("El enlace debe empezar por http(s)://"));
  let res: Response;
  try {
    res = await fetch(u, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36",
      Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
  } catch {
    throw new Error(t("No se pudo conectar con {host}.", { host: u.hostname }));
  }
  if (!res.ok) throw new Error(t("No se pudo descargar la imagen (error {status}).", { status: res.status }));
  const tipo = res.headers.get("content-type") ?? "";
  if (!tipo.startsWith("image/")) throw new Error(tx("Ese enlace no es una imagen (copia la dirección de la imagen, no de la página)."));
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error(tx("La imagen es demasiado grande (máx. 15 MB)."));
  return buf;
}

export async function importarImagenDesdeUrl(url: string, t: T = tEs) {
  return guardarImagen(await descargarImagen(url, t), url);
}

// Borra una imagen si ya no la usa ningún producto ni sabor
export async function borrarSiHuerfana(id: number | null | undefined) {
  if (!id) return;
  await db.execute(sql`
    delete from imagenes where id = ${id}
      and not exists (select 1 from productos where imagen_id = ${id})
      and not exists (select 1 from variantes where imagen_id = ${id})
  `);
}

export async function leerImagen(id: number) {
  const [fila] = await db.select().from(imagenes).where(eq(imagenes.id, id));
  return fila ?? null;
}
