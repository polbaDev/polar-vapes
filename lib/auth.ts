// Autenticación sencilla con una sola contraseña (APP_PASSWORD).
// La cookie guarda un HMAC; si cambias la contraseña, todas las sesiones caducan.
// Funciona igual en Node y en el runtime de Proxy.

export const COOKIE = "vapers_sesion";

async function hmac(secret: string, msg: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function authConfigurada() {
  return Boolean(process.env.APP_PASSWORD && process.env.AUTH_SECRET);
}

export async function tokenSesion() {
  return hmac(process.env.AUTH_SECRET!, `sesion:${process.env.APP_PASSWORD}`);
}

export function igualSeguro(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function sesionValida(valor: string | undefined) {
  if (!authConfigurada() || !valor) return false;
  return igualSeguro(valor, await tokenSesion());
}
