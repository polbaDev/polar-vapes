"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { cierresCaja, movimientosCaja } from "@/lib/db/schema";
import { exigirSesion } from "@/lib/session";
import { cuentasCaja, efectivoEsperado, periodoAbierto } from "@/lib/caja";
import { redondear } from "@/lib/format";
import { type Resultado, texto, textoONulo, entero, decimal, mensajeError } from "./tipos";

function refrescar() {
  revalidatePath("/", "layout");
}

function importe(fd: FormData, campo: string, nombre: string, obligatorio = true): number | null {
  const v = decimal(fd, campo);
  if (v === null) {
    if (obligatorio) throw new Error(`Escribe ${nombre}.`);
    return null;
  }
  if (Number.isNaN(v) || v < 0) throw new Error(`${nombre[0].toUpperCase()}${nombre.slice(1)} no es un importe válido.`);
  return redondear(v);
}

// ---------- Entradas y salidas de dinero ----------

export async function crearMovimientoCaja(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  try {
    const tipo = texto(fd, "tipo");
    if (tipo !== "entrada" && tipo !== "salida") throw new Error("Elige si el dinero entra o sale.");
    const cantidad = importe(fd, "importe", "el importe")!;
    if (cantidad <= 0) throw new Error("El importe tiene que ser mayor que 0.");
    const motivo = texto(fd, "motivo");
    if (!motivo) throw new Error("Escribe el motivo (ej. «Pago al repartidor», «Al banco»).");
    // clock_timestamp: la hora real de la base de datos, la misma que usan las ventas y los cierres
    await db.insert(movimientosCaja).values({ tipo, importe: cantidad.toFixed(2), motivo, fecha: sql`clock_timestamp()` });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  refrescar();
  return { ok: "Apuntado." };
}

export async function borrarMovimientoCaja(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const id = entero(fd, "id");
  if (!id) return { error: "Movimiento no válido." };
  try {
    // Solo se puede borrar si aún no está incluido en un cierre
    const borrados = await db.execute(sql`
      delete from movimientos_caja
      where id = ${id}
        and fecha > coalesce((select max(hasta) from cierres_caja), '-infinity'::timestamptz)
      returning id
    `);
    if ((borrados as unknown as unknown[]).length === 0) {
      return { error: "No se puede borrar: ya está incluido en un cierre de caja." };
    }
  } catch (e) {
    return { error: mensajeError(e) };
  }
  refrescar();
  return { ok: "Borrado." };
}

// ---------- Cierre ----------

export async function cerrarCaja(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  let id: number;
  try {
    const ultimoVisto = entero(fd, "ultimo") ?? 0;
    const contado = importe(fd, "contado", "el efectivo contado")!;
    const fondoSiguiente = importe(fd, "fondo_siguiente", "lo que dejas en caja")!;
    if (fondoSiguiente > contado) throw new Error("No puedes dejar en caja más de lo que has contado.");
    const fondoForm = importe(fd, "fondo_inicial", "el efectivo con el que empezaste", false);
    const notas = textoONulo(fd, "notas");

    id = await db.transaction(async (tx) => {
      // Mientras se cierra, nadie puede registrar ni anular ventas ni movimientos de caja:
      // así ninguna operación se queda fuera de este cierre y del siguiente.
      await tx.execute(sql`lock table cierres_caja, ventas, movimientos_caja in share row exclusive mode`);
      const periodo = await periodoAbierto(tx);
      if ((periodo.ultimoId ?? 0) !== ultimoVisto) {
        throw new Error("La caja ya se ha cerrado desde otra pantalla. Recarga la página para ver el periodo nuevo.");
      }
      const fondo = periodo.fondoInicial ?? fondoForm;
      if (fondo === null) throw new Error("Escribe el efectivo con el que empezaste.");

      const [{ ahora }] = (await tx.execute(sql`select clock_timestamp() as ahora`)) as unknown as { ahora: Date }[];
      const hasta = new Date(ahora);
      const c = await cuentasCaja(tx, periodo.desde, hasta);
      const esperado = efectivoEsperado(fondo, c);

      const [fila] = await tx
        .insert(cierresCaja)
        .values({
          desde: periodo.desde,
          hasta,
          fondoInicial: fondo.toFixed(2),
          ventasEfectivo: c.ventasEfectivo.toFixed(2),
          devolucionesEfectivo: c.devolucionesEfectivo.toFixed(2),
          entradas: c.entradas.toFixed(2),
          salidas: c.salidas.toFixed(2),
          esperado: esperado.toFixed(2),
          contado: contado.toFixed(2),
          descuadre: redondear(contado - esperado).toFixed(2),
          fondoSiguiente: fondoSiguiente.toFixed(2),
          ventasTarjeta: c.ventasTarjeta.toFixed(2),
          ventasBizum: c.ventasBizum.toFixed(2),
          tickets: c.tickets,
          notas,
        })
        .returning({ id: cierresCaja.id });
      return fila.id;
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  refrescar();
  redirect(`/caja/${id}?nuevo=1`);
}

// Deshace el último cierre (por si contaste mal): su periodo vuelve a quedar abierto.
// Las ventas y movimientos no se tocan, porque pertenecen a un cierre solo por su hora.
export async function reabrirCaja(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const id = entero(fd, "id");
  if (!id) return { error: "Cierre no válido." };
  if (fd.get("confirmar") !== "on") return { error: "Marca la casilla para confirmar." };
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`lock table cierres_caja in share row exclusive mode`);
      const [ultimo] = (await tx.execute(
        sql`select id from cierres_caja order by hasta desc, id desc limit 1`,
      )) as unknown as { id: number }[];
      if (!ultimo || ultimo.id !== id) throw new Error("Solo se puede reabrir el último cierre.");
      await tx.execute(sql`delete from cierres_caja where id = ${id}`);
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  refrescar();
  redirect("/caja");
}
