export type Resultado = { ok?: string; error?: string; id?: number } | null;

export function texto(fd: FormData, campo: string) {
  const v = fd.get(campo);
  return typeof v === "string" ? v.trim() : "";
}

export function textoONulo(fd: FormData, campo: string) {
  const v = texto(fd, campo);
  return v === "" ? null : v;
}

export function entero(fd: FormData, campo: string): number | null {
  const v = texto(fd, campo);
  if (v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
}

export function decimal(fd: FormData, campo: string): number | null {
  const v = texto(fd, campo).replace(",", ".");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

// Traduce errores de Postgres a mensajes entendibles
export function mensajeError(e: unknown): string {
  const err = e as { code?: string; cause?: { code?: string; constraint_name?: string }; message?: string };
  const code = err?.code ?? err?.cause?.code;
  if (code === "23505") return "Ya existe un registro con ese nombre o código.";
  if (code === "23503") return "No se puede borrar: está en uso. Puedes desactivarlo en su lugar.";
  if (code === "23514") return "Algún valor no es válido (revisa cantidades y precios).";
  if (err?.message && !code) return err.message;
  console.error(e);
  return "Ha ocurrido un error inesperado.";
}
