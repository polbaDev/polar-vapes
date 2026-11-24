import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Contraseñas de las cuentas: se guarda una huella scrypt con sal, nunca la contraseña.
// Formato: scrypt$N$r$p$sal$huella (sal y huella en base64)

const N = 16384;
const R = 8;
const P = 1;
const LARGO = 32;
export const MIN_CLAVE = 8;

function derivar(clave: string, sal: Buffer, n: number, r: number, p: number) {
  return new Promise<Buffer>((ok, mal) =>
    scrypt(clave.normalize("NFC"), sal, LARGO, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? mal(e) : ok(k))),
  );
}

export async function huellaClave(clave: string) {
  const sal = randomBytes(16);
  const k = await derivar(clave, sal, N, R, P);
  return `scrypt$${N}$${R}$${P}$${sal.toString("base64")}$${k.toString("base64")}`;
}

export async function claveCorrecta(clave: string, guardada: string) {
  const m = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([A-Za-z0-9+/=]+)\$([A-Za-z0-9+/=]+)$/.exec(guardada);
  if (!m) return false;
  const [, n, r, p, sal, huella] = m;
  const esperada = Buffer.from(huella, "base64");
  const k = await derivar(clave, Buffer.from(sal, "base64"), Number(n), Number(r), Number(p));
  return k.length === esperada.length && timingSafeEqual(k, esperada);
}

// Para tardar lo mismo cuando el nombre no existe (así no se sabe qué nombres hay)
let falsa: Promise<string> | null = null;
export async function compararConFalsa(clave: string) {
  falsa ??= huellaClave(randomBytes(12).toString("hex"));
  await claveCorrecta(clave, await falsa);
  return false;
}
