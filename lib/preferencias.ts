// Preferencias de cada navegador: tema e idioma. Se guardan en cookies para que el servidor pinte la página
// ya con el tema y el idioma correctos (sin destellos) y para que los mensajes de las acciones salgan en su idioma.
// Cada subdominio (gestión y catálogo) recuerda las suyas.

export const COOKIE_TEMA = "tema";
export const COOKIE_IDIOMA = "idioma";
export const UN_ANO = 60 * 60 * 24 * 365;

export const TEMAS = ["claro", "oscuro", "sistema"] as const;
export type Tema = (typeof TEMAS)[number];
export function esTema(v: unknown): v is Tema {
  return TEMAS.includes(v as Tema);
}

export const IDIOMAS = ["es", "ca"] as const;
export type Idioma = (typeof IDIOMAS)[number];
export const IDIOMA_DEFECTO: Idioma = "es";
// Cada idioma se nombra en sí mismo
export const NOMBRE_IDIOMA: Record<Idioma, string> = { es: "Castellano", ca: "Català" };
export function esIdioma(v: unknown): v is Idioma {
  return IDIOMAS.includes(v as Idioma);
}

// Color de la barra del navegador en móvil
export const COLOR_BARRA = { claro: "#f6f2ee", oscuro: "#120b0d" } as const;
