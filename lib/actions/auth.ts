"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { intentosLogin } from "@/lib/db/schema";
import {
  COOKIE,
  COOKIE_DISPOSITIVO,
  DIAS_DISPOSITIVO,
  DIAS_SESION,
  crearTokenDispositivo,
  crearTokenSesion,
  igualSeguro,
  leerDispositivo,
} from "@/lib/auth";
import { versionSesion } from "@/lib/ajustes";
import { huellaOrigen } from "@/lib/origen";
import { avisoAuth } from "@/lib/session";
import { traductor } from "@/lib/i18n/servidor";
import type { Resultado } from "./tipos";

// Bloqueo de quien prueba contraseñas: 5 fallos desde la misma conexión en 15 minutos la bloquean;
// 30 fallos en total en 15 minutos bloquean la entrada (por si alguien cambia de IP), salvo desde
// los dispositivos en los que ya se entró antes (cookie vapers_dispositivo): así la tienda siempre puede entrar.
// Esos dispositivos cuentan sus fallos aparte: nadie puede bloquearlos fallando desde su misma IP
// (con Docker Desktop toda la WiFi llega con la misma) ni haciéndose pasar por ella.
const MINUTOS = 15;
const MAX_POR_ORIGEN = 5;
const MAX_TOTAL = 30;

export async function entrar(_: Resultado, fd: FormData): Promise<Resultado> {
  const t = await traductor();
  const aviso = avisoAuth(t);
  if (aviso) return { error: aviso };
  const jar = await cookies();
  const version = await versionSesion();
  // Solo vale si se marcó con la versión actual: al cerrar la sesión en todos los dispositivos deja de valer
  const deConfianza = (await leerDispositivo(jar.get(COOKIE_DISPOSITIVO)?.value)) === version;
  const origen = (await huellaOrigen()) + (deConfianza ? ":dispositivo" : "");

  // Contar y apuntar el intento de una vez (con un candado), para que muchas peticiones a la vez
  // no vean todas la cuenta vieja. El intento cuenta como fallo hasta que la contraseña sea buena.
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
      error:
        n.propios >= MAX_POR_ORIGEN
          ? t("Demasiados intentos fallidos. Espera {minutos} minutos y vuelve a probar.", { minutos: MINUTOS })
          : t(
              "Entrada bloqueada por demasiados intentos fallidos. Espera {minutos} minutos o entra desde un dispositivo en el que ya hayas entrado antes.",
              { minutos: MINUTOS },
            ),
    };
  }

  const pass = String(fd.get("password") ?? "");
  // Pequeña pausa para frenar intentos a lo bruto
  await new Promise((r) => setTimeout(r, 400));
  if (!(await igualSeguro(pass, process.env.APP_PASSWORD!))) {
    const quedan = MAX_POR_ORIGEN - n.propios - 1;
    return {
      error:
        quedan > 0
          ? quedan === 1
            ? t("Contraseña incorrecta. Te queda 1 intento.")
            : t("Contraseña incorrecta. Te quedan {n} intentos.", { n: quedan })
          : t("Contraseña incorrecta. Espera {minutos} minutos antes de volver a probar.", { minutos: MINUTOS }),
    };
  }
  await db.delete(intentosLogin).where(eq(intentosLogin.origen, origen));

  const h = await headers();
  const https = h.get("x-forwarded-proto") === "https";
  const opciones = { httpOnly: true, sameSite: "lax", secure: https, path: "/" } as const;
  jar.set(COOKIE, await crearTokenSesion(version), { ...opciones, maxAge: 60 * 60 * 24 * DIAS_SESION });
  jar.set(COOKIE_DISPOSITIVO, await crearTokenDispositivo(version), { ...opciones, maxAge: 60 * 60 * 24 * DIAS_DISPOSITIVO });
  redirect("/");
}

// La cookie de dispositivo se queda: sigue siendo de confianza para volver a entrar
export async function salir() {
  (await cookies()).delete(COOKIE);
  redirect("/login");
}
