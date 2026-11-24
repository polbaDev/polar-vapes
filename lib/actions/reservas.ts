"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db, type Tx } from "@/lib/db";
import { reservas, lineasReserva } from "@/lib/db/schema";
import { bloquearVariantes } from "@/lib/bloqueo";
import { leerAjustes } from "@/lib/ajustes";
import { huellaOrigen } from "@/lib/origen";
import { tx, type T } from "@/lib/i18n";
import { traductor } from "@/lib/i18n/servidor";
import { limpiarCodigo } from "@/lib/reservas";
import { exigirSesion } from "@/lib/session";
import { type Resultado, texto, entero, mensajeError } from "./tipos";

// Límites contra reservas falsas desde el catálogo público
const ACTIVAS_POR_ORIGEN = 3;
const NUEVAS_POR_ORIGEN_HORA = 6;
const NUEVAS_TOTAL_HORA = 100;

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin I, O, 0 ni 1 para que no se confundan

function nuevoCodigo() {
  return [...randomBytes(6)].map((b) => ALFABETO[b & 31]).join("");
}

function refrescar() {
  revalidatePath("/", "layout");
}

// Mensaje al intentar tocar una reserva que ya se cerró
const YA_CERRADA: Record<string, string> = {
  vendida: tx("Esta reserva ya está vendida."),
  rechazada: tx("Esta reserva ya está rechazada."),
  cancelada: tx("Esta reserva ya está cancelada."),
};

// Comprueba que hay unidades libres (stock - apartado por otras reservas) para estas líneas
async function comprobarLibres(tx: Tx, lineas: Map<number, number>, excluirReserva: number | null, publico: boolean, t: T) {
  const estado = await bloquearVariantes(tx, [...lineas.keys()], excluirReserva, t);
  for (const [vid, cant] of lineas) {
    const v = estado.get(vid)!;
    const libres = v.stock - v.reservado;
    if (publico && (!v.activo || v.precio <= 0)) throw new Error(t("Algún producto ya no está disponible. Recarga el catálogo."));
    if (libres < cant) {
      const sabor = v.nombre.split(" · ")[1] ?? v.nombre;
      throw new Error(
        publico
          ? t("No quedan suficientes unidades de {sabor}. Prueba con menos o elige otro sabor.", { sabor })
          : t('De "{nombre}" solo hay {libres} libres ({stock} en stock, {reservado} apartadas en otras reservas).', {
              nombre: v.nombre,
              libres: Math.max(libres, 0),
              stock: v.stock,
              reservado: v.reservado,
            }),
      );
    }
  }
  return estado;
}

// ======================= DESDE EL CATÁLOGO (sin contraseña) =======================

export type ReservaInput = {
  nombre: string;
  lineas: { varianteId: number; cantidad: number }[];
  // Campo trampa: los robots lo rellenan, las personas no lo ven
  web?: string;
};

export async function crearReserva(input: ReservaInput): Promise<Resultado & { codigo?: string }> {
  const t = await traductor();
  try {
    const ajustes = await leerAjustes();
    if (!ajustes.catalogoAbierto) throw new Error(t("Ahora mismo no se pueden hacer reservas."));
    if (input.web) throw new Error(t("No se pudo hacer la reserva."));
    const nombre = String(input.nombre ?? "").trim().replace(/\s+/g, " ");
    if (nombre.length < 2) throw new Error(t("Escribe tu nombre."));
    if (nombre.length > 60) throw new Error(t("El nombre es demasiado largo."));
    const lineas = new Map<number, number>();
    for (const l of Array.isArray(input.lineas) ? input.lineas : []) {
      if (!Number.isInteger(l.varianteId) || !Number.isInteger(l.cantidad) || l.cantidad < 0) throw new Error(t("Cantidades no válidas."));
      if (l.cantidad > 0) lineas.set(l.varianteId, (lineas.get(l.varianteId) ?? 0) + l.cantidad);
    }
    const unidades = [...lineas.values()].reduce((s, n) => s + n, 0);
    if (unidades === 0) throw new Error(t("Elige al menos un producto."));
    if (unidades > ajustes.maxUnidades) {
      throw new Error(
        ajustes.maxUnidades === 1
          ? t("Como mucho 1 unidad por reserva.")
          : t("Como mucho {n} unidades por reserva.", { n: ajustes.maxUnidades }),
      );
    }

    const origen = await huellaOrigen();
    const [lim] = (await db.execute(sql`
      select
        count(*) filter (where origen = ${origen} and estado in ('pendiente', 'confirmada') and caduca_en > now())::int as activas,
        count(*) filter (where origen = ${origen} and creada_en > now() - interval '1 hour')::int as propias_hora,
        count(*) filter (where creada_en > now() - interval '1 hour')::int as total_hora
      from reservas
    `)) as unknown as { activas: number; propias_hora: number; total_hora: number }[];
    if (lim.activas >= ACTIVAS_POR_ORIGEN) {
      throw new Error(t("Ya tienes {n} reservas en curso. Espera a que te las confirmemos o cancela alguna.", { n: lim.activas }));
    }
    if (lim.propias_hora >= NUEVAS_POR_ORIGEN_HORA || lim.total_hora >= NUEVAS_TOTAL_HORA) {
      throw new Error(t("Se han hecho demasiadas reservas seguidas. Prueba un poco más tarde."));
    }

    const codigo = await db.transaction(async (tx) => {
      const estado = await comprobarLibres(tx, lineas, null, true, t);
      let codigo = nuevoCodigo();
      for (let i = 0; i < 5; i++) {
        const [ya] = await tx.select({ id: reservas.id }).from(reservas).where(eq(reservas.codigo, codigo));
        if (!ya) break;
        codigo = nuevoCodigo();
      }
      const [r] = await tx
        .insert(reservas)
        .values({
          codigo,
          nombre,
          estado: "pendiente",
          caducaEn: sql`now() + make_interval(mins => ${ajustes.minutosConfirmar}::int)`,
          origen,
        })
        .returning({ id: reservas.id });
      for (const [vid, cant] of lineas) {
        await tx.insert(lineasReserva).values({
          reservaId: r.id,
          varianteId: vid,
          cantidad: cant,
          precioUnidad: estado.get(vid)!.precio.toFixed(2),
        });
      }
      return codigo;
    });
    refrescar();
    return { ok: t("Reserva hecha."), codigo };
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
}

export async function cancelarReservaCliente(codigoTexto: string): Promise<Resultado> {
  const t = await traductor();
  try {
    const codigo = limpiarCodigo(String(codigoTexto ?? ""));
    if (!codigo) throw new Error(t("Reserva no válida."));
    const filas = await db.execute(sql`
      update reservas set estado = 'cancelada', cerrada_en = now()
      where codigo = ${codigo} and estado in ('pendiente', 'confirmada')
      returning id
    `);
    if ((filas as unknown as unknown[]).length === 0) throw new Error(t("Esta reserva ya no se puede cancelar."));
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescar();
  return { ok: t("Reserva cancelada.") };
}

// ======================= DESDE LA GESTIÓN =======================

async function lineasActuales(tx: Tx, reservaId: number) {
  const rows = await tx.select().from(lineasReserva).where(eq(lineasReserva.reservaId, reservaId));
  return new Map(rows.map((l) => [l.varianteId, l.cantidad]));
}

async function bloquearReserva(tx: Tx, id: number, t: T) {
  const [r] = (await tx.execute(sql`
    select id, estado, caduca_en <= now() as caducada from reservas where id = ${id} for update
  `)) as unknown as { id: number; estado: string; caducada: boolean }[];
  if (!r) throw new Error(t("La reserva no existe."));
  return r;
}

// Confirmar (también una caducada, si sigue habiendo unidades) o ampliar el plazo de una confirmada
export async function confirmarReserva(_: Resultado, fd: FormData): Promise<Resultado> {
  const t = await traductor();
  await exigirSesion();
  const id = entero(fd, "id");
  if (!id) return { error: t("Reserva no válida.") };
  try {
    const { horasCerrar } = await leerAjustes();
    await db.transaction(async (tx) => {
      const r = await bloquearReserva(tx, id, t);
      if (r.estado !== "pendiente" && r.estado !== "confirmada") throw new Error(t(YA_CERRADA[r.estado] ?? "Esta reserva ya estaba cerrada."));
      // Si había caducado, sus unidades se liberaron: hay que ver si siguen libres
      if (r.caducada) await comprobarLibres(tx, await lineasActuales(tx, id), id, false, t);
      await tx.execute(sql`
        update reservas
        set estado = 'confirmada', confirmada_en = coalesce(confirmada_en, now()),
            caduca_en = now() + make_interval(hours => ${horasCerrar}::int)
        where id = ${id}
      `);
    });
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescar();
  return { ok: t("Reserva confirmada. Las unidades quedan apartadas.") };
}

// Rechazar (pendiente) o cancelar (confirmada o caducada): libera las unidades
export async function cerrarReserva(_: Resultado, fd: FormData): Promise<Resultado> {
  const t = await traductor();
  await exigirSesion();
  const id = entero(fd, "id");
  const estado = texto(fd, "estado");
  if (!id || (estado !== "rechazada" && estado !== "cancelada")) return { error: t("Acción no válida.") };
  try {
    const filas = await db.execute(sql`
      update reservas set estado = ${estado}, cerrada_en = now()
      where id = ${id} and estado in ('pendiente', 'confirmada')
      returning id
    `);
    if ((filas as unknown as unknown[]).length === 0) throw new Error(t("Esta reserva ya estaba cerrada."));
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescar();
  return { ok: estado === "rechazada" ? t("Reserva rechazada.") : t("Reserva cancelada.") };
}

// Cambiar cantidades (si en el WhatsApp cambia algo) y las notas
export async function editarReserva(_: Resultado, fd: FormData): Promise<Resultado> {
  const t = await traductor();
  await exigirSesion();
  const id = entero(fd, "id");
  if (!id) return { error: t("Reserva no válida.") };
  try {
    await db.transaction(async (tx) => {
      const r = await bloquearReserva(tx, id, t);
      if (r.estado !== "pendiente" && r.estado !== "confirmada") throw new Error(t(YA_CERRADA[r.estado] ?? "Esta reserva ya estaba cerrada."));
      const lineas = await tx.select().from(lineasReserva).where(eq(lineasReserva.reservaId, id));
      const nuevas = new Map<number, number>();
      for (const l of lineas) {
        const n = entero(fd, `cantidad_${l.id}`);
        if (n === null || Number.isNaN(n) || n < 0) throw new Error(t("Revisa las cantidades (números enteros)."));
        nuevas.set(l.id, n);
      }
      if ([...nuevas.values()].every((n) => n === 0)) {
        throw new Error(t("La reserva no puede quedarse vacía. Si ya no la quiere, cancélala."));
      }
      // Solo hay que comprobar unidades libres si se piden más que antes (o si había caducado)
      const aComprobar = new Map<number, number>();
      for (const l of lineas) {
        const n = nuevas.get(l.id)!;
        if (n > 0 && (r.caducada || n > l.cantidad)) aComprobar.set(l.varianteId, (aComprobar.get(l.varianteId) ?? 0) + n);
      }
      if (aComprobar.size) await comprobarLibres(tx, aComprobar, id, false, t);
      for (const l of lineas) {
        const n = nuevas.get(l.id)!;
        if (n === 0) await tx.delete(lineasReserva).where(eq(lineasReserva.id, l.id));
        else if (n !== l.cantidad) await tx.update(lineasReserva).set({ cantidad: n }).where(eq(lineasReserva.id, l.id));
      }
      await tx.update(reservas).set({ notas: texto(fd, "notas") || null }).where(eq(reservas.id, id));
    });
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescar();
  return { ok: t("Cambios guardados.") };
}
