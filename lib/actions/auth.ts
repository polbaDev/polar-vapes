"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { intentosLogin, usuarios } from "@/lib/db/schema";
import { COOKIE, COOKIE_DISPOSITIVO, igualSeguro, leerDispositivo } from "@/lib/auth";
import { versionSesion } from "@/lib/ajustes";
import { claveCorrecta, compararConFalsa, huellaClave, MIN_CLAVE } from "@/lib/claves";
import { huellaOrigen } from "@/lib/origen";
import { abrirSesion, avisoAuth } from "@/lib/session";
import { traductor } from "@/lib/i18n/servidor";
import type { T } from "@/lib/i18n";
import { type Resultado, texto } from "./tipos";

// Bloqueo de quien prueba contraseñas: 5 fallos desde la misma conexión en 15 minutos la bloquean;
// 30 fallos en total en 15 minutos bloquean la entrada (por si alguien cambia de IP), salvo desde
// los dispositivos en los que ya se entró antes (cookie vapers_dispositivo): así la tienda siempre puede entrar.
// Esos dispositivos cuentan sus fallos aparte: nadie puede bloquearlos fallando desde su misma IP
// (con Docker Desktop toda la WiFi llega con la misma) ni haciéndose pasar por ella.
// Cuenta igual un nombre que no existe que una contraseña mal puesta.
const MINUTOS = 15;
const MAX_POR_ORIGEN = 5;
const MAX_TOTAL = 30;

// Apunta el intento (cuenta como fallo hasta que la contraseña sea buena). Devuelve el error si está bloqueado.
async function apuntarIntento(t: T) {
  const jar = await cookies();
  const version = await versionSesion();
  // Solo vale si se marcó con la versión actual: al cerrar la sesión en todos los dispositivos deja de valer
  const deConfianza = (await leerDispositivo(jar.get(COOKIE_DISPOSITIVO)?.value)) === version;
  const origen = (await huellaOrigen()) + (deConfianza ? ":dispositivo" : "");

  // Contar y apuntar el intento de una vez (con un candado), para que muchas peticiones a la vez
  // no vean todas la cuenta vieja.
  const n = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('login'))`);
    await tx.execute(sql`delete from intentos_login where fecha < now() - interval '1 day'`);
    const [n] = (await tx.execute(sql`
      select count(*) filter (where origen = ${origen})::int as propios, count(*)::int as total
      from intentos_login where fecha > now() - make_interval(mins => ${MINUTOS}::int)
    `)) as unknown as { propios: number; total: number }[];
    if (n.propios >= MAX_POR_ORIGEN || (!deConfianza && n.total >= MAX_TOTAL)) return { ...n, bloqueado: true };
    await tx.insert(intentosLogin).values({ origen });
    return { ...n, bloqueado: false };
  });
  if (n.bloqueado) {
    return {
      origen,
      version,
      error:
        n.propios >= MAX_POR_ORIGEN
          ? t("Demasiados intentos fallidos. Espera {minutos} minutos y vuelve a probar.", { minutos: MINUTOS })
          : t(
              "Entrada bloqueada por demasiados intentos fallidos. Espera {minutos} minutos o entra desde un dispositivo en el que ya hayas entrado antes.",
              { minutos: MINUTOS },
            ),
    };
  }
  const quedan = MAX_POR_ORIGEN - n.propios - 1;
  return {
    origen,
    version,
    error: null,
    // Mensaje si resulta que la contraseña está mal
    fallo: (base: string) =>
      quedan > 0
        ? quedan === 1
          ? t("{error} Te queda 1 intento.", { error: base })
          : t("{error} Te quedan {n} intentos.", { error: base, n: quedan })
        : t("{error} Espera {minutos} minutos antes de volver a probar.", { error: base, minutos: MINUTOS }),
  };
}

// Pequeña pausa para frenar intentos a lo bruto
const pausa = () => new Promise((r) => setTimeout(r, 400));

export async function entrar(_: Resultado, fd: FormData): Promise<Resultado> {
  const t = await traductor();
  const aviso = avisoAuth(t);
  if (aviso) return { error: aviso };
  const nombre = texto(fd, "nombre");
  const clave = String(fd.get("password") ?? "");
  if (!nombre) return { error: t("Escribe tu nombre.") };

  const intento = await apuntarIntento(t);
  if (intento.error !== null) return { error: intento.error };

  await pausa();
  const [u] = await db
    .select({ id: usuarios.id, clave: usuarios.clave, activo: usuarios.activo, sesionVersion: usuarios.sesionVersion })
    .from(usuarios)
    .where(sql`lower(${usuarios.nombre}) = lower(${nombre})`);
  const bien = u ? await claveCorrecta(clave, u.clave) : await compararConFalsa(clave);
  if (!u || !bien) return { error: intento.fallo(t("Nombre o contraseña incorrectos.")) };
  if (!u.activo) return { error: t("Esta cuenta está desactivada. Pide a tu socio que la vuelva a activar.") };

  await db.delete(intentosLogin).where(eq(intentosLogin.origen, intento.origen));
  await abrirSesion(u, intento.version);
  redirect("/");
}

// La primera vez que se usa la app no hay cuentas: se crea la primera con la contraseña de la app (APP_PASSWORD)
export async function crearPrimeraCuenta(_: Resultado, fd: FormData): Promise<Resultado> {
  const t = await traductor();
  const aviso = avisoAuth(t);
  if (aviso) return { error: aviso };
  const nombre = texto(fd, "nombre");
  const clave = String(fd.get("clave") ?? "");
  const repetida = String(fd.get("repetir") ?? "");
  if (!nombre) return { error: t("Escribe tu nombre.") };
  if (nombre.length > 40) return { error: t("El nombre es demasiado largo.") };
  if (clave.length < MIN_CLAVE) return { error: t("La contraseña necesita al menos {n} caracteres.", { n: MIN_CLAVE }) };
  if (clave !== repetida) return { error: t("Las dos contraseñas no coinciden.") };

  const intento = await apuntarIntento(t);
  if (intento.error !== null) return { error: intento.error };
  await pausa();
  if (!(await igualSeguro(String(fd.get("password_app") ?? ""), process.env.APP_PASSWORD!))) {
    return { error: intento.fallo(t("La contraseña de la app no es correcta.")) };
  }

  const huella = await huellaClave(clave);
  const creado = await db.transaction(async (tx) => {
    // Con candado: si dos personas lo hacen a la vez, solo una crea la primera cuenta
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('primera_cuenta'))`);
    const [hay] = (await tx.execute(sql`select exists (select 1 from usuarios) as hay`)) as unknown as { hay: boolean }[];
    if (hay.hay) return null;
    const [u] = await tx
      .insert(usuarios)
      .values({ nombre, clave: huella, socio: true })
      .returning({ id: usuarios.id, sesionVersion: usuarios.sesionVersion });
    return u;
  });
  if (!creado) return { error: t("Ya hay cuentas creadas. Recarga la página y entra con la tuya.") };

  await db.delete(intentosLogin).where(eq(intentosLogin.origen, intento.origen));
  await abrirSesion(creado, intento.version);
  redirect("/socios/cuentas?primera=1");
}

// La cookie de dispositivo se queda: sigue siendo de confianza para volver a entrar
export async function salir() {
  (await cookies()).delete(COOKIE);
  redirect("/login");
}
