"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { intentosLogin } from "@/lib/db/schema";
import { COOKIE, authConfigurada, igualSeguro, tokenSesion } from "@/lib/auth";
import { huellaOrigen } from "@/lib/origen";
import type { Resultado } from "./tipos";

// Bloqueo de quien prueba contraseñas: 5 fallos desde la misma conexión en 15 minutos la bloquean;
// 30 fallos en total en 15 minutos bloquean la entrada a todos (por si alguien cambia de IP).
const MINUTOS = 15;
const MAX_POR_ORIGEN = 5;
const MAX_TOTAL = 30;

export async function entrar(_: Resultado, fd: FormData): Promise<Resultado> {
  if (!authConfigurada()) {
    return { error: "Falta configurar APP_PASSWORD y AUTH_SECRET en el archivo .env" };
  }
  const origen = await huellaOrigen();
  await db.execute(sql`delete from intentos_login where fecha < now() - interval '1 day'`);
  const [n] = (await db.execute(sql`
    select count(*) filter (where origen = ${origen})::int as propios, count(*)::int as total
    from intentos_login where fecha > now() - make_interval(mins => ${MINUTOS}::int)
  `)) as unknown as { propios: number; total: number }[];
  if (n.propios >= MAX_POR_ORIGEN || n.total >= MAX_TOTAL) {
    return { error: `Demasiados intentos fallidos. Espera ${MINUTOS} minutos y vuelve a probar.` };
  }

  const pass = String(fd.get("password") ?? "");
  // Pequeña pausa para frenar intentos a lo bruto
  await new Promise((r) => setTimeout(r, 400));
  if (!igualSeguro(pass, process.env.APP_PASSWORD!)) {
    await db.insert(intentosLogin).values({ origen });
    const quedan = MAX_POR_ORIGEN - n.propios - 1;
    return {
      error:
        quedan > 0
          ? `Contraseña incorrecta. Te quedan ${quedan} ${quedan === 1 ? "intento" : "intentos"}.`
          : `Contraseña incorrecta. Espera ${MINUTOS} minutos antes de volver a probar.`,
    };
  }
  await db.delete(intentosLogin).where(eq(intentosLogin.origen, origen));

  const h = await headers();
  const https = h.get("x-forwarded-proto") === "https";
  (await cookies()).set(COOKIE, await tokenSesion(), {
    httpOnly: true,
    sameSite: "lax",
    secure: https,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}

export async function salir() {
  (await cookies()).delete(COOKIE);
  redirect("/login");
}
