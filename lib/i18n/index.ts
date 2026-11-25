// Traducciones. Como en finqcat (gettext), la clave es el propio texto en castellano:
//   t("Ventas")                      → "Vendes" en catalán, "Ventas" en castellano
//   t("Faltan {importe}", { importe }) → las variables van entre llaves y se respetan en la traducción
// Si un texto no está en el diccionario se muestra en castellano, así nunca sale una clave rota.
// Los diccionarios están en ./ca/*.json (uno por zona de la app) y se comprueban con `npm run i18n`.

import { IDIOMA_DEFECTO, type Idioma } from "@/lib/preferencias";
import comun from "./ca/comun.json";
import ventas from "./ca/ventas.json";
import compras from "./ca/compras.json";
import catalogo from "./ca/catalogo.json";
import reservas from "./ca/reservas.json";
import socios from "./ca/socios.json";

export type Vars = Record<string, string | number>;
export type T = (texto: string, vars?: Vars) => string;

const CA: Record<string, string> = { ...comun, ...ventas, ...compras, ...catalogo, ...reservas, ...socios };
const DICCIONARIOS: Record<Idioma, Record<string, string> | null> = { es: null, ca: CA };
// Textos que ya son una traducción: mensajeError vuelve a pasar por t() mensajes que ya llegan traducidos
const YA_TRADUCIDOS = new Set(Object.values(CA));

function interpolar(texto: string, vars?: Vars) {
  if (!vars) return texto;
  return texto.replace(/\{(\w+)\}/g, (m, clave: string) => (clave in vars ? String(vars[clave]) : m));
}

const avisados = new Set<string>();
function avisarFalta(texto: string) {
  if (avisados.has(texto) || YA_TRADUCIDOS.has(texto)) return;
  avisados.add(texto);
  console.warn(`[i18n] Falta la traducción al catalán de: ${JSON.stringify(texto)}`);
}

const traductores = new Map<Idioma, T>();

export function crearT(idioma: Idioma): T {
  let t = traductores.get(idioma);
  if (!t) {
    const dic = DICCIONARIOS[idioma];
    t = (texto, vars) => {
      const traducido = dic?.[texto];
      if (dic && traducido === undefined && process.env.NODE_ENV !== "production") avisarFalta(texto);
      return interpolar(traducido ?? texto, vars);
    };
    traductores.set(idioma, t);
  }
  return t;
}

// Traductor en castellano: valor por defecto de las funciones que reciben `t` opcional
export const tEs = crearT(IDIOMA_DEFECTO);

// Marca un texto como traducible sin traducirlo todavía (listas de constantes, menús…).
// Se traduce al pintarlo con t(texto). `npm run i18n` comprueba que esté en el diccionario.
export const tx = (texto: string) => texto;
