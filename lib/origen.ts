import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { esHostCatalogo } from "@/lib/hosts";

// IP del visitante. Con Cloudflare llega en cf-connecting-ip (no se puede falsear desde fuera);
// detrás de otro proxy, en x-real-ip o x-forwarded-for.
async function ipCliente() {
  const h = await headers();
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    "local"
  );
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
