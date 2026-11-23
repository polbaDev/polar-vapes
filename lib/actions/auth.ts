"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, authConfigurada, igualSeguro, tokenSesion } from "@/lib/auth";
import type { Resultado } from "./tipos";

export async function entrar(_: Resultado, fd: FormData): Promise<Resultado> {
  if (!authConfigurada()) {
    return { error: "Falta configurar APP_PASSWORD y AUTH_SECRET en el archivo .env" };
  }
  const pass = String(fd.get("password") ?? "");
  // Pequeña pausa para frenar intentos a lo bruto
  await new Promise((r) => setTimeout(r, 400));
  if (!igualSeguro(pass, process.env.APP_PASSWORD!)) {
    return { error: "Contraseña incorrecta." };
  }
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
