import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { COOKIE_IDIOMA, COOKIE_TEMA, IDIOMA_DEFECTO, esIdioma, esTema, type Idioma, type Tema } from "@/lib/preferencias";
import { crearT } from "@/lib/i18n";

// Idioma y tema de quien hace la petición (una lectura por petición)
export const idiomaActual = cache(async (): Promise<Idioma> => {
  const v = (await cookies()).get(COOKIE_IDIOMA)?.value;
  return esIdioma(v) ? v : IDIOMA_DEFECTO;
});

export const temaActual = cache(async (): Promise<Tema> => {
  const v = (await cookies()).get(COOKIE_TEMA)?.value;
  return esTema(v) ? v : "sistema";
});

// En páginas, layouts y acciones del servidor: const t = await traductor();
export async function traductor() {
  return crearT(await idiomaActual());
}
