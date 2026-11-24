"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { compras, movimientosSocios, ventas } from "@/lib/db/schema";
import { exigirSesion } from "@/lib/session";
import { esSocioActivo } from "@/lib/socios";
import { listarSocios } from "@/lib/usuarios";
import { redondear } from "@/lib/format";
import { traductor } from "@/lib/i18n/servidor";
import type { T } from "@/lib/i18n";
import { type Resultado, texto, textoONulo, entero, decimal, mensajeError } from "./tipos";

function refrescar() {
  revalidatePath("/", "layout");
}

function importePositivo(fd: FormData, t: T) {
  const v = decimal(fd, "importe");
  if (v === null) throw new Error(t("Escribe el importe."));
  if (Number.isNaN(v) || v <= 0) throw new Error(t("El importe tiene que ser mayor que 0."));
  if (v > 1_000_000) throw new Error(t("El importe no es válido."));
  return redondear(v);
}

async function socioDe(fd: FormData, campo: string, t: T) {
  const id = entero(fd, campo);
  if (!id || !(await esSocioActivo(id))) throw new Error(t("Elige un socio de la lista."));
  return id;
}

// «comun» (o vacío) = dinero de la tienda; si no, un socio activo
async function socioOComun(valor: string, t: T) {
  if (valor === "comun" || valor === "") return null;
  const id = Number(valor);
  if (!Number.isInteger(id) || !(await esSocioActivo(id))) throw new Error(t("Elige un socio de la lista."));
  return id;
}

// Apunta un pago entre socios, un gasto, un reparto de ganancias o un saldo de partida
export async function apuntarMovimientoSocio(_: Resultado, fd: FormData): Promise<Resultado> {
  const yo = await exigirSesion();
  const t = await traductor();
  try {
    const tipo = texto(fd, "tipo");
    const importe = importePositivo(fd, t);
    const motivo = textoONulo(fd, "motivo");
    if (motivo && motivo.length > 200) throw new Error(t("El texto es demasiado largo."));
    const base = { tipo, importe: importe.toFixed(2), motivo, usuarioId: yo.id };
    if (tipo === "pago") {
      const de = await socioDe(fd, "de", t);
      const para = await socioDe(fd, "para", t);
      if (de === para) throw new Error(t("Elige dos socios distintos."));
      await db.insert(movimientosSocios).values({ ...base, deId: de, paraId: para });
    } else if (tipo === "gasto") {
      if (!motivo) throw new Error(t("Escribe qué se pagó (ej. «Bolsas», «Alquiler de noviembre»)."));
      await db.insert(movimientosSocios).values({ ...base, deId: await socioDe(fd, "de", t) });
    } else if (tipo === "reparto") {
      // Lo mismo para cada socio, en una sola inserción: comparten la hora (así se anulan juntos)
      const socios = await listarSocios();
      if (socios.length < 2) throw new Error(t("Para repartir hacen falta al menos dos socios."));
      await db.insert(movimientosSocios).values(socios.map((s) => ({ ...base, deId: s.id })));
    } else if (tipo === "ajuste") {
      if (!motivo) throw new Error(t("Escribe de qué es (ej. «Stock inicial que pagué yo»)."));
      const socio = await socioDe(fd, "socio", t);
      const sentido = texto(fd, "sentido");
      if (sentido !== "puso" && sentido !== "tiene") throw new Error(t("Elige si puso dinero suyo o tiene dinero de la tienda."));
      await db.insert(movimientosSocios).values({ ...base, ...(sentido === "puso" ? { deId: socio } : { paraId: socio }) });
    } else {
      throw new Error(t("Elige qué quieres apuntar."));
    }
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescar();
  return { ok: t("Apuntado.") };
}

// Se anula (no se borra): sigue en la lista tachado. Un reparto se anula entero (todas sus filas).
export async function anularMovimientoSocio(_: Resultado, fd: FormData): Promise<Resultado> {
  const yo = await exigirSesion();
  const t = await traductor();
  const id = entero(fd, "id");
  if (!id) return { error: t("Movimiento no válido.") };
  try {
    const n = await db.execute(sql`
      update movimientos_socios s set anulado = true, anulado_en = now(), anulado_por_id = ${yo.id}
      from movimientos_socios m
      where m.id = ${id} and not s.anulado
        and (s.id = m.id or (m.tipo = 'reparto' and s.tipo = 'reparto' and s.fecha = m.fecha))
      returning s.id
    `);
    if ((n as unknown as unknown[]).length === 0) throw new Error(t("Ese movimiento ya estaba anulado."));
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescar();
  return { ok: t("Anulado.") };
}

// Para corregir a quién le llegó el dinero de una venta con Bizum o tarjeta
export async function cambiarRecibeVenta(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const t = await traductor();
  const id = entero(fd, "id");
  if (!id) return { error: t("Venta no válida.") };
  try {
    const recibe = await socioOComun(texto(fd, "recibe"), t);
    const r = await db
      .update(ventas)
      .set({ recibeId: recibe })
      .where(and(eq(ventas.id, id), eq(ventas.anulada, false), ne(ventas.metodoPago, "efectivo")))
      .returning({ id: ventas.id });
    if (r.length === 0) throw new Error(t("Solo se puede cambiar en ventas con Bizum o tarjeta que no estén anuladas."));
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescar();
  return { ok: t("Guardado.") };
}

// Para corregir quién pagó una compra (o apuntarlo en las de antes de las cuentas)
export async function cambiarPagaCompra(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const t = await traductor();
  const id = entero(fd, "id");
  if (!id) return { error: t("Compra no válida.") };
  try {
    const paga = await socioOComun(texto(fd, "paga"), t);
    const r = await db
      .update(compras)
      .set({ pagaId: paga })
      .where(and(eq(compras.id, id), eq(compras.anulada, false)))
      .returning({ id: compras.id });
    if (r.length === 0) throw new Error(t("La compra no existe o está anulada."));
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescar();
  return { ok: t("Guardado.") };
}
