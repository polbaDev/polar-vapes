// ¿La petición llega por el subdominio del catálogo público?
// Por defecto, cualquier dirección que empiece por «catalogo.» (catalogo.tudominio.es, catalogo.localhost…).
// Se puede fijar uno concreto con la variable CATALOGO_HOST.
// Cualquier otra dirección (gestion.tudominio.es, localhost, la IP del PC…) es la app de gestión.
export function esHostCatalogo(host: string | null | undefined) {
  const h = (host ?? "").split(":")[0].trim().toLowerCase();
  const fijo = process.env.CATALOGO_HOST?.trim().toLowerCase();
  return fijo ? h === fijo : h.startsWith("catalogo.");
}
