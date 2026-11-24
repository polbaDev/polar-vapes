import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, estadoAuth, leerSesion } from "@/lib/auth";
import { versionSesion } from "@/lib/ajustes";
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

// La cookie de esta petición es una sesión válida y de la versión actual (no se cerró en todos los dispositivos).
// `version`: la guardada en ajustes, si ya se ha leído; si no, se lee aquí.
export async function sesionAlDia(version?: number) {
  const s = await leerSesion((await cookies()).get(COOKIE)?.value);
  if (!s) return false;
  return s.version === (version ?? (await versionSesion()));
}

// Segunda comprobación dentro de cada acción del servidor (el Proxy es la primera y guarda la versión unos segundos).
// Si no vale, se vuelve a la pantalla de entrar (con un error solo se vería «Algo ha fallado»).
export async function exigirSesion() {
  if (!(await sesionAlDia())) {
    (await cookies()).delete(COOKIE);
    redirect("/login");
  }
}
