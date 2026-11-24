// Autenticación sencilla con una sola contraseña (APP_PASSWORD).
// La cookie de sesión es «emitida.version.firma»: caduca a los 30 días y deja de valer si cambias
// la contraseña o AUTH_SECRET, o si se sube la versión de las sesiones («Cerrar sesión en todos los dispositivos»).
// Aquí solo se miran la firma y la edad; la versión guardada la comparan el Proxy y lib/session.ts (necesitan la base de datos).
// Funciona igual en Node y en el runtime de Proxy: solo Web Crypto, sin node: ni base de datos.

export const COOKIE = "vapers_sesion";
// Dispositivo en el que ya se entró alguna vez: no le afecta el bloqueo general por intentos fallidos.
// Lleva la versión de las sesiones: al cerrar la sesión en todos los dispositivos deja de ser de confianza.
export const COOKIE_DISPOSITIVO = "vapers_dispositivo";

const DIA = 60 * 60 * 24;
export const DIAS_SESION = 30;
export const DIAS_DISPOSITIVO = 365;
// Margen por si el reloj de quien emitió la cookie iba un poco adelantado
const MARGEN_RELOJ = 5 * 60;

// Valores de ejemplo (.env.example y versiones antiguas): con ellos no se deja entrar
const CLAVES_EJEMPLO = ["cambiame", "cambia-esta-contraseña"];
const SECRETO_EJEMPLO = "cambia-esto-por-una-cadena-larga-y-aleatoria";

async function hmac(secret: string, msg: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function ahora() {
  return Math.floor(Date.now() / 1000);
}

// "falta": no hay APP_PASSWORD o AUTH_SECRET; "debil": son los de ejemplo o demasiado cortos
export function estadoAuth(): "ok" | "falta" | "debil" {
  const pass = process.env.APP_PASSWORD;
  const secreto = process.env.AUTH_SECRET;
  if (!pass || !secreto) return "falta";
  if (CLAVES_EJEMPLO.includes(pass) || pass.length < 8) return "debil";
  if (secreto === SECRETO_EJEMPLO || secreto.length < 32) return "debil";
  return "ok";
}

export function authConfigurada() {
  return estadoAuth() === "ok";
}

// Compara sin cortar en la primera diferencia ni delatar la longitud: compara las huellas SHA-256
export async function igualSeguro(a: string, b: string) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let r = 0;
  for (let i = 0; i < x.length; i++) r |= x[i] ^ y[i];
  return r === 0;
}

// Edad correcta: ni del futuro (más allá del margen) ni más vieja que `dias`
function edadValida(emitida: number, dias: number) {
  const edad = ahora() - emitida;
  return edad >= -MARGEN_RELOJ && edad < dias * DIA;
}

function firmaSesion(emitida: string, version: string) {
  return hmac(process.env.AUTH_SECRET!, `sesion:${emitida}:${version}:${process.env.APP_PASSWORD}`);
}

export async function crearTokenSesion(version: number) {
  const emitida = String(ahora());
  return `${emitida}.${version}.${await firmaSesion(emitida, String(version))}`;
}

// Datos de una cookie de sesión bien firmada y sin caducar; null si no vale
export async function leerSesion(valor: string | undefined) {
  if (!authConfigurada() || !valor) return null;
  const m = /^(\d{1,12})\.(\d{1,15})\.([0-9a-f]{64})$/.exec(valor);
  if (!m) return null;
  const [, emitida, version, firma] = m;
  if (!edadValida(Number(emitida), DIAS_SESION)) return null;
  if (!(await igualSeguro(firma, await firmaSesion(emitida, version)))) return null;
  return { emitida: Number(emitida), version: Number(version) };
}

function firmaDispositivo(emitida: string, version: string) {
  return hmac(process.env.AUTH_SECRET!, `dispositivo:${emitida}:${version}`);
}

export async function crearTokenDispositivo(version: number) {
  const emitida = String(ahora());
  return `${emitida}.${version}.${await firmaDispositivo(emitida, String(version))}`;
}

// Versión de las sesiones con la que se marcó el dispositivo; null si la cookie no vale
export async function leerDispositivo(valor: string | undefined) {
  if (!authConfigurada() || !valor) return null;
  const m = /^(\d{1,12})\.(\d{1,15})\.([0-9a-f]{64})$/.exec(valor);
  if (!m) return null;
  const [, emitida, version, firma] = m;
  if (!edadValida(Number(emitida), DIAS_DISPOSITIVO)) return null;
  if (!(await igualSeguro(firma, await firmaDispositivo(emitida, version)))) return null;
  return Number(version);
}
