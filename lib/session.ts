import "server-only";
import { cookies } from "next/headers";
import { COOKIE, sesionValida } from "@/lib/auth";

// Segunda comprobación dentro de cada acción del servidor (el Proxy es la primera).
export async function exigirSesion() {
  const c = await cookies();
  if (!(await sesionValida(c.get(COOKIE)?.value))) {
    throw new Error("Sesión no válida. Vuelve a entrar.");
  }
}
