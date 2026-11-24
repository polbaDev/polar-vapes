import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { ajustes } from "@/lib/db/schema";

export type Ajustes = {
  nombreTienda: string;
  // Teléfono de WhatsApp de la tienda, como se escribió
  whatsapp: string;
  // Dirección, horario o lo que quieras que lea el cliente al reservar
  info: string;
  // Tiempo que tiene una reserva para que la confirmes
  minutosConfirmar: number;
  // Tiempo que dura apartada una reserva confirmada
  horasCerrar: number;
  // Máximo de unidades en una reserva
  maxUnidades: number;
  catalogoAbierto: boolean;
};

// Opciones que se pueden elegir en Ajustes
export const MINUTOS_CONFIRMAR = [30, 60, 120, 240, 480, 1440];
export const HORAS_CERRAR = [4, 12, 24, 48, 72];

export const AJUSTES_POR_DEFECTO: Ajustes = {
  nombreTienda: "Catálogo",
  whatsapp: "",
  info: "",
  minutosConfirmar: 120,
  horasCerrar: 24,
  maxUnidades: 10,
  catalogoAbierto: true,
};

const CLAVES: Record<keyof Ajustes, string> = {
  nombreTienda: "nombre_tienda",
  whatsapp: "whatsapp",
  info: "info",
  minutosConfirmar: "minutos_confirmar",
  horasCerrar: "horas_cerrar",
  maxUnidades: "max_unidades",
  catalogoAbierto: "catalogo_abierto",
};

// Versión de las sesiones: al subirla, las cookies emitidas antes dejan de valer (ver lib/auth.ts)
const CLAVE_VERSION_SESION = "sesion_version";

function numeroVersion(valor: string | undefined) {
  const n = Number(valor);
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

export async function versionSesion() {
  const [f] = await db.select({ valor: ajustes.valor }).from(ajustes).where(eq(ajustes.clave, CLAVE_VERSION_SESION));
  return numeroVersion(f?.valor);
}

// Para el Proxy, que la mira en cada petición: se guarda unos segundos en memoria para no leer la base de datos cada vez
const SEGUNDOS_VERSION = 5;
let versionGuardada: { valor: number; hasta: number } | null = null;

export async function versionSesionReciente() {
  if (versionGuardada && versionGuardada.hasta > Date.now()) return versionGuardada.valor;
  const valor = await versionSesion();
  versionGuardada = { valor, hasta: Date.now() + SEGUNDOS_VERSION * 1000 };
  return valor;
}

// Cierra la sesión en todos los dispositivos. Devuelve la versión nueva.
export async function subirVersionSesion() {
  const [f] = await db
    .insert(ajustes)
    .values({ clave: CLAVE_VERSION_SESION, valor: "1" })
    .onConflictDoUpdate({
      target: ajustes.clave,
      set: { valor: sql`(case when ${ajustes.valor} ~ '^[0-9]{1,15}$' then ${ajustes.valor}::bigint else 0 end + 1)::text` },
    })
    .returning({ valor: ajustes.valor });
  return numeroVersion(f.valor);
}

export async function leerAjustes(): Promise<Ajustes> {
  return (await leerAjustesYSesion()).ajustes;
}

// Ajustes y versión de las sesiones en una sola consulta (para el layout de la gestión)
export async function leerAjustesYSesion(): Promise<{ ajustes: Ajustes; versionSesion: number }> {
  const filas = await db.select().from(ajustes);
  const m = new Map(filas.map((f) => [f.clave, f.valor]));
  const num = (k: keyof Ajustes, def: number) => {
    const n = Number(m.get(CLAVES[k]));
    return Number.isFinite(n) && n > 0 ? n : def;
  };
  const d = AJUSTES_POR_DEFECTO;
  return {
    ajustes: {
      nombreTienda: m.get(CLAVES.nombreTienda) || d.nombreTienda,
      whatsapp: m.get(CLAVES.whatsapp) ?? d.whatsapp,
      info: m.get(CLAVES.info) ?? d.info,
      minutosConfirmar: num("minutosConfirmar", d.minutosConfirmar),
      horasCerrar: num("horasCerrar", d.horasCerrar),
      maxUnidades: num("maxUnidades", d.maxUnidades),
      catalogoAbierto: m.has(CLAVES.catalogoAbierto) ? m.get(CLAVES.catalogoAbierto) === "1" : d.catalogoAbierto,
    },
    versionSesion: numeroVersion(m.get(CLAVE_VERSION_SESION)),
  };
}

export async function guardarAjustesEnDb(a: Ajustes) {
  const filas = (Object.keys(CLAVES) as (keyof Ajustes)[]).map((k) => ({
    clave: CLAVES[k],
    valor: typeof a[k] === "boolean" ? (a[k] ? "1" : "0") : String(a[k]),
  }));
  await db.transaction(async (tx) => {
    for (const f of filas) {
      await tx.insert(ajustes).values(f).onConflictDoUpdate({ target: ajustes.clave, set: { valor: f.valor } });
    }
  });
}

// Teléfono en formato internacional sin "+" para wa.me (los de 9 cifras se toman como de España)
export function telefonoWhatsApp(t: string | null | undefined) {
  if (!t) return null;
  let d = t.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (/^[6789]\d{8}$/.test(d)) d = `34${d}`;
  return /^\d{8,15}$/.test(d) ? d : null;
}
