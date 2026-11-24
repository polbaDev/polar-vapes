import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { esHostCatalogo } from "@/lib/hosts";

// IP del visitante. Solo se mira una cabecera, la que pone quien está delante de la app,
// porque las demás las puede inventar cualquiera:
//  - CABECERA_IP (p. ej. cf-connecting-ip con el túnel de Cloudflare): solo esa.
//  - En Vercel: x-real-ip (Vercel la sobrescribe).
//  - Si no, entrada directa por la WiFi de la tienda: la primera de x-forwarded-for (si no llega,
//    Next.js la rellena con la IP de la conexión; solo se podría falsear desde la WiFi de la tienda).
async function ipCliente() {
  const h = await headers();
  const cabecera = process.env.CABECERA_IP?.trim() || (process.env.VERCEL ? "x-real-ip" : "x-forwarded-for");
  return h.get(cabecera)?.split(",")[0].trim() || "local";
}

// Huella de la IP: sirve para contar intentos sin guardar la IP en sí
export async function huellaOrigen() {
  const ip = await ipCliente();
  return createHmac("sha256", process.env.AUTH_SECRET || "sin-secreto").update(ip).digest("hex").slice(0, 32);
}

// Prefijo de las rutas públicas: "" en catalogo.tudominio.es, "/tienda" si se ve desde la gestión
export async function basePublica() {
  const h = await headers();
  return esHostCatalogo(h.get("host")) ? "" : "/tienda";
}
