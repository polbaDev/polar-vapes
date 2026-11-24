"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { versionSesion } from "@/lib/ajustes";
import { claveCorrecta, huellaClave, MIN_CLAVE } from "@/lib/claves";
import { abrirSesion, exigirSesion } from "@/lib/session";
import { esSocioActivo, guardarTarjetaRecibe } from "@/lib/socios";
import { traductor } from "@/lib/i18n/servidor";
import type { T } from "@/lib/i18n";
import { type Resultado, texto, entero, mensajeError } from "./tipos";

// Cuentas de las personas: cualquiera que haya entrado puede gestionarlas (sois socios y os fiáis el uno del otro).
// Una cuenta no se borra: se desactiva, y sus ventas siguen a su nombre.

function refrescar() {
  revalidatePath("/", "layout");
}

function comprobarNombre(nombre: string, t: T) {
  if (!nombre) throw new Error(t("Escribe el nombre."));
  if (nombre.length > 40) throw new Error(t("El nombre es demasiado largo."));
}

function comprobarClave(clave: string, repetida: string | null, t: T) {
  if (clave.length < MIN_CLAVE) throw new Error(t("La contraseña necesita al menos {n} caracteres.", { n: MIN_CLAVE }));
  if (repetida !== null && clave !== repetida) throw new Error(t("Las dos contraseñas no coinciden."));
}

export async function crearCuenta(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const t = await traductor();
  const nombre = texto(fd, "nombre");
  try {
    comprobarNombre(nombre, t);
    const clave = String(fd.get("clave") ?? "");
    comprobarClave(clave, null, t);
    await db.insert(usuarios).values({ nombre, clave: await huellaClave(clave), socio: fd.get("socio") === "on" });
  } catch (e) {
    const err = e as { code?: string; cause?: { code?: string } };
    if ((err?.code ?? err?.cause?.code) === "23505") return { error: t("Ya hay una cuenta con ese nombre.") };
    return { error: mensajeError(e, t) };
  }
  refrescar();
  return { ok: t("Cuenta de {nombre} creada. Ya puede entrar con su nombre y esa contraseña.", { nombre }) };
}

export async function editarCuenta(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const t = await traductor();
  const id = entero(fd, "id");
  if (!id) return { error: t("Cuenta no válida.") };
  const nombre = texto(fd, "nombre");
  const socio = fd.get("socio") === "on";
  try {
    comprobarNombre(nombre, t);
    const r = await db.update(usuarios).set({ nombre, socio }).where(eq(usuarios.id, id)).returning({ id: usuarios.id });
    if (r.length === 0) throw new Error(t("Cuenta no válida."));
  } catch (e) {
    const err = e as { code?: string; cause?: { code?: string } };
    if ((err?.code ?? err?.cause?.code) === "23505") return { error: t("Ya hay una cuenta con ese nombre.") };
    return { error: mensajeError(e, t) };
  }
  refrescar();
  return { ok: t("Guardado.") };
}

// Contraseña nueva para otra cuenta (si se le ha olvidado). Sus sesiones abiertas se cierran.
export async function cambiarClaveDe(_: Resultado, fd: FormData): Promise<Resultado> {
  const yo = await exigirSesion();
  const t = await traductor();
  const id = entero(fd, "id");
  if (!id) return { error: t("Cuenta no válida.") };
  if (id === yo.id) return { error: t("Para cambiar la tuya, usa «Mi contraseña».") };
  try {
    const clave = String(fd.get("clave") ?? "");
    comprobarClave(clave, null, t);
    const huella = await huellaClave(clave);
    const r = await db
      .update(usuarios)
      .set({ clave: huella, sesionVersion: sql`${usuarios.sesionVersion} + 1` })
      .where(eq(usuarios.id, id))
      .returning({ nombre: usuarios.nombre });
    if (r.length === 0) throw new Error(t("Cuenta no válida."));
    refrescar();
    return { ok: t("Contraseña de {nombre} cambiada. Tendrá que volver a entrar en sus dispositivos.", { nombre: r[0].nombre }) };
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
}

// Cambia la contraseña propia: las demás sesiones de esta cuenta se cierran y esta sigue abierta
export async function cambiarMiClave(_: Resultado, fd: FormData): Promise<Resultado> {
  const yo = await exigirSesion();
  const t = await traductor();
  try {
    const actual = String(fd.get("actual") ?? "");
    const clave = String(fd.get("clave") ?? "");
    comprobarClave(clave, String(fd.get("repetir") ?? ""), t);
    const [u] = await db.select({ clave: usuarios.clave }).from(usuarios).where(eq(usuarios.id, yo.id));
    if (!u || !(await claveCorrecta(actual, u.clave))) throw new Error(t("Tu contraseña actual no es correcta."));
    const [nuevo] = await db
      .update(usuarios)
      .set({ clave: await huellaClave(clave), sesionVersion: sql`${usuarios.sesionVersion} + 1` })
      .where(eq(usuarios.id, yo.id))
      .returning({ id: usuarios.id, sesionVersion: usuarios.sesionVersion });
    await abrirSesion(nuevo, await versionSesion());
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  return { ok: t("Contraseña cambiada. Tus otros dispositivos tendrán que volver a entrar.") };
}

// Desactivar: no puede entrar y sus sesiones se cierran al momento. Sus ventas y su dinero siguen a su nombre.
export async function activarCuenta(_: Resultado, fd: FormData): Promise<Resultado> {
  const yo = await exigirSesion();
  const t = await traductor();
  const id = entero(fd, "id");
  const activo = texto(fd, "activo") === "1";
  if (!id) return { error: t("Cuenta no válida.") };
  if (id === yo.id && !activo) return { error: t("No puedes desactivar tu propia cuenta.") };
  try {
    await db
      .update(usuarios)
      .set({ activo, ...(activo ? {} : { sesionVersion: sql`${usuarios.sesionVersion} + 1` }) })
      .where(and(eq(usuarios.id, id), ne(usuarios.activo, activo)));
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescar();
  return { ok: activo ? t("Cuenta activada.") : t("Cuenta desactivada. Ya no puede entrar.") };
}

// A quién le llega lo cobrado con tarjeta (el datáfono ingresa en la cuenta de un socio o en la de la tienda)
export async function guardarDestinoTarjeta(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const t = await traductor();
  const valor = texto(fd, "tarjeta");
  try {
    const id = valor === "comun" || valor === "" ? null : Number(valor);
    if (id !== null && (!Number.isInteger(id) || !(await esSocioActivo(id)))) throw new Error(t("Elige un socio de la lista."));
    await guardarTarjetaRecibe(id);
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescar();
  return { ok: t("Guardado. Se aplica a las ventas con tarjeta a partir de ahora.") };
}
