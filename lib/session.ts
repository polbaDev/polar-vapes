import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  COOKIE,
  COOKIE_DISPOSITIVO,
  DIAS_DISPOSITIVO,
  DIAS_SESION,
  crearTokenDispositivo,
  crearTokenSesion,
  estadoAuth,
  leerSesion,
} from "@/lib/auth";
import { usuarioYVersion, type Usuario } from "@/lib/usuarios";
import type { T } from "@/lib/i18n";

// Por qué no se puede entrar si APP_PASSWORD o AUTH_SECRET no sirven; null si están bien
export function avisoAuth(t: T) {
  const estado = estadoAuth();
  if (estado === "falta") return t("Falta configurar APP_PASSWORD y AUTH_SECRET en el archivo .env");
  if (estado === "debil") {
    return t(
      "El archivo .env aún tiene los valores de ejemplo o son demasiado cortos (APP_PASSWORD necesita al menos 8 caracteres y AUTH_SECRET, 32). Con Docker, ejecuta parar.bat y arrancar.bat: arrancar.bat los cambia por unos nuevos y te enseña la contraseña. Si no, cámbialos a mano.",
    );
  }
  return null;
}

function numeroVersion(valor: string | null | undefined) {
  const n = Number(valor);
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

// Cuenta de quien hace esta petición, si su sesión vale: bien firmada, de la versión actual (no se cerró
// en todos los dispositivos) y de una cuenta activa que no ha cambiado de contraseña desde entonces.
// Una lectura por petición.
export const usuarioActual = cache(async (): Promise<Usuario | null> => {
  const s = await leerSesion((await cookies()).get(COOKIE)?.value);
  if (!s) return null;
  const u = await usuarioYVersion(s.usuarioId);
  if (!u || !u.activo) return null;
  if (s.version !== numeroVersion(u.versionGlobal) || s.versionUsuario !== u.sesionVersion) return null;
  return { id: u.id, nombre: u.nombre, socio: u.socio, activo: u.activo, sesionVersion: u.sesionVersion };
});

// Segunda comprobación dentro de cada acción del servidor (el Proxy es la primera y guarda las versiones unos segundos).
// Si no vale, se vuelve a la pantalla de entrar (con un error solo se vería «Algo ha fallado»).
export async function exigirSesion(): Promise<Usuario> {
  const u = await usuarioActual();
  if (!u) {
    (await cookies()).delete(COOKIE);
    redirect("/login");
  }
  return u;
}

// Deja la sesión abierta en este dispositivo para esa cuenta (al entrar o al cambiar la contraseña).
// También marca el dispositivo como de confianza (ver lib/actions/auth.ts).
export async function abrirSesion(u: { id: number; sesionVersion: number }, versionGlobal: number) {
  const jar = await cookies();
  const https = (await headers()).get("x-forwarded-proto") === "https";
  const opciones = { httpOnly: true, sameSite: "lax", secure: https, path: "/" } as const;
  jar.set(COOKIE, await crearTokenSesion(u.id, versionGlobal, u.sesionVersion), { ...opciones, maxAge: 60 * 60 * 24 * DIAS_SESION });
  jar.set(COOKIE_DISPOSITIVO, await crearTokenDispositivo(versionGlobal), { ...opciones, maxAge: 60 * 60 * 24 * DIAS_DISPOSITIVO });
}
