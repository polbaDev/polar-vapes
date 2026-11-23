// Carga el catálogo inicial (datos/catalogo-inicial.json) si la base de datos no tiene productos.
// Descarga las imágenes de internet y, si no puede, usa las de respaldo de datos/imagenes.
// Uso: npm run db:seed        (Docker lo ejecuta solo al arrancar)
//      npm run db:seed -- --forzar   (añade lo que falte aunque ya haya productos)
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import sharp from "sharp";

const url = process.env.DATABASE_URL_MIGRATIONS || process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL");
  process.exit(1);
}
const forzar = process.argv.includes("--forzar");
const carpeta = (ruta) => fileURLToPath(new URL(`../datos/${ruta}`, import.meta.url));
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

async function procesar(buf) {
  const out = await sharp(buf, { failOn: "none" })
    .rotate()
    .resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84 })
    .toBuffer({ resolveWithObject: true });
  const { dominant } = await sharp(out.data).stats();
  const hex = (n) => n.toString(16).padStart(2, "0");
  return { datos: out.data, ancho: out.info.width, alto: out.info.height, color: `#${hex(dominant.r)}${hex(dominant.g)}${hex(dominant.b)}` };
}

async function guardar(buf, origen) {
  const p = await procesar(buf);
  const [f] = await sql`
    insert into imagenes (tipo, datos, ancho, alto, color, origen)
    values ('image/webp', ${p.datos}, ${p.ancho}, ${p.alto}, ${p.color}, ${origen})
    returning id`;
  return f.id;
}

async function descargar(u) {
  const res = await fetch(u, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!(res.headers.get("content-type") ?? "").startsWith("image/")) throw new Error("no es una imagen");
  return Buffer.from(await res.arrayBuffer());
}

// Intenta la imagen de internet; si falla, la local. Devuelve el id o null.
async function imagenPara(item, etiqueta) {
  if (item.url) {
    try {
      return { id: await guardar(await descargar(item.url), item.url), deInternet: true };
    } catch (e) {
      console.log(`  · ${etiqueta}: no se pudo descargar (${e.message}); uso la de respaldo`);
    }
  }
  if (item.archivo) {
    try {
      return { id: await guardar(await readFile(carpeta(item.archivo)), "cartel"), deInternet: false };
    } catch (e) {
      console.log(`  · ${etiqueta}: sin imagen (${e.message})`);
    }
  }
  return { id: null, deInternet: false };
}

try {
  const [{ n }] = await sql`select count(*)::int as n from productos`;
  if (n > 0 && !forzar) {
    console.log("Catálogo inicial: ya hay productos, no se toca nada.");
    process.exit(0);
  }
  const catalogo = JSON.parse(await readFile(carpeta("catalogo-inicial.json"), "utf8"));
  let descargadas = 0;
  let respaldo = 0;

  for (const p of catalogo.productos) {
    console.log(`Cargando ${p.marca} ${p.modelo}…`);
    const [marca] = await sql`
      insert into marcas (nombre) values (${p.marca})
      on conflict (nombre) do update set nombre = excluded.nombre
      returning id`;
    const existente = await sql`select id, imagen_id from productos where marca_id = ${marca.id} and modelo = ${p.modelo}`;
    let productoId = existente[0]?.id;
    if (!productoId) {
      const img = p.imagen ? await imagenPara(p.imagen, "producto") : { id: null };
      const [prod] = await sql`
        insert into productos (marca_id, modelo, tipo, caladas, ml, descripcion, caracteristicas, imagen_id, imagen_fuente)
        values (${marca.id}, ${p.modelo}, ${p.tipo}, ${p.caladas ?? null}, ${p.ml ?? null}, ${p.descripcion ?? null},
                ${(p.caracteristicas ?? []).join("\n") || null}, ${img.id}, ${p.imagen?.url ?? null})
        returning id`;
      productoId = prod.id;
    }

    for (const s of p.sabores) {
      const [sabor] = await sql`
        insert into sabores (nombre, categoria, descripcion) values (${s.nombre}, ${s.categoria}, ${s.descripcion ?? null})
        on conflict (nombre) do update set descripcion = coalesce(sabores.descripcion, excluded.descripcion)
        returning id`;
      const nic = s.nicotinaMg ?? p.nicotinaMg ?? 0;
      const ya = await sql`select id from variantes where producto_id = ${productoId} and sabor_id = ${sabor.id} and nicotina_mg = ${nic}`;
      if (ya.length) continue;
      const img = await imagenPara(s, s.nombre);
      if (img.id) img.deInternet ? descargadas++ : respaldo++;
      await sql`
        insert into variantes (producto_id, sabor_id, nicotina_mg, precio_venta, stock_minimo, imagen_id, imagen_fuente)
        values (${productoId}, ${sabor.id}, ${nic}, ${(s.precio ?? p.precio ?? 0).toFixed(2)}, ${s.stockMinimo ?? p.stockMinimo ?? 0},
                ${img.id}, ${s.url ?? null})`;
    }
    console.log(`  ✔ ${p.sabores.length} sabores`);
  }
  console.log(`Catálogo inicial cargado. Imágenes de internet: ${descargadas}, de respaldo: ${respaldo}.`);
  if (respaldo > 0) console.log("  En la ficha del producto tienes el botón «Descargar imágenes en alta» para reintentarlo.");
} catch (e) {
  // Nunca impedimos que arranque la app por esto
  console.error("No se pudo cargar el catálogo inicial:", e.message);
} finally {
  await sql.end();
}
