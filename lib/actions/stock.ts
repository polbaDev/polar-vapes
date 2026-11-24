"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { db, type Tx } from "@/lib/db";
import { bloquearVariantes, costeTrasEntrada } from "@/lib/bloqueo";
import {
  compras,
  lineasCompra,
  ventas,
  lineasVenta,
  variantes,
  movimientosStock,
  proveedores,
  devoluciones,
  lineasDevolucion,
} from "@/lib/db/schema";
import { costeTrasAnularCompra } from "@/lib/coste-calculo";
import { importesDevolucion } from "@/lib/devolucion-calculo";
import { exigirSesion } from "@/lib/session";
import { METODOS_PAGO, MOTIVOS_AJUSTE, valores, etiqueta } from "@/lib/constants";
import { euros, redondear } from "@/lib/format";
import { tx } from "@/lib/i18n";
import { traductor } from "@/lib/i18n/servidor";
import { type Resultado, texto, entero, mensajeError } from "./tipos";

// Textos de los throw: los fijos van con tx() y los traduce mensajeError(e, t) al recogerlos; los que llevan
// variables, y los de dentro de db.transaction (allí `tx` es la transacción), se traducen ya con t().

function refrescarStock() {
  revalidatePath("/", "layout");
}

// ======================= COMPRAS =======================

export type LineaCompraInput = { varianteId: number; cantidad: number; costeUnidad: number; lote?: string | null };
export type CompraInput = {
  proveedorId: number | null;
  proveedorNuevo?: string | null;
  fecha: string;
  numFactura?: string | null;
  gastosEnvio: number;
  notas?: string | null;
  lineas: LineaCompraInput[];
};

export async function crearCompra(input: CompraInput): Promise<Resultado> {
  await exigirSesion();
  const t = await traductor();
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) throw new Error(tx("Fecha no válida."));
    const lineas = input.lineas.filter((l) => l.varianteId);
    if (lineas.length === 0) throw new Error(tx("Añade al menos un producto a la compra."));
    for (const l of lineas) {
      if (!Number.isInteger(l.cantidad) || l.cantidad <= 0) throw new Error(tx("Las cantidades deben ser números enteros mayores que 0."));
      if (!Number.isFinite(l.costeUnidad) || l.costeUnidad < 0) throw new Error(tx("Revisa los costes por unidad."));
    }
    const envio = Number.isFinite(input.gastosEnvio) && input.gastosEnvio > 0 ? input.gastosEnvio : 0;
    const subtotal = lineas.reduce((s, l) => s + l.cantidad * l.costeUnidad, 0);
    // Repartimos el envío en proporción al importe de cada línea
    const factor = subtotal > 0 ? envio / subtotal : 0;
    const total = redondear(subtotal + envio);

    const id = await db.transaction(async (tx) => {
      let proveedorId = input.proveedorId || null;
      const nuevo = input.proveedorNuevo?.trim();
      if (nuevo) {
        const [ex] = await tx.select().from(proveedores).where(sql`lower(${proveedores.nombre}) = lower(${nuevo})`);
        proveedorId = ex
          ? ex.id
          : (await tx.insert(proveedores).values({ nombre: nuevo }).returning({ id: proveedores.id }))[0].id;
      }

      const [c] = await tx
        .insert(compras)
        .values({
          proveedorId,
          fecha: input.fecha,
          numFactura: input.numFactura?.trim() || null,
          gastosEnvio: envio.toFixed(2),
          total: total.toFixed(2),
          notas: input.notas?.trim() || null,
        })
        .returning({ id: compras.id });

      const estado = await bloquearVariantes(tx, lineas.map((l) => l.varianteId), undefined, t);

      for (const l of lineas) {
        const costeReal = l.costeUnidad * (1 + factor);
        const v = estado.get(l.varianteId)!;
        const nuevoCoste = costeTrasEntrada(v.stock, v.coste, l.cantidad, costeReal);
        await tx.insert(lineasCompra).values({
          compraId: c.id,
          varianteId: l.varianteId,
          cantidad: l.cantidad,
          costeUnidad: l.costeUnidad.toFixed(4),
          costeReal: costeReal.toFixed(4),
          lote: l.lote?.trim() || null,
        });
        await tx.insert(movimientosStock).values({
          varianteId: l.varianteId,
          tipo: "compra",
          cantidad: l.cantidad,
          compraId: c.id,
        });
        await tx.update(variantes).set({ costeMedio: nuevoCoste.toFixed(4) }).where(eq(variantes.id, l.varianteId));
        v.stock += l.cantidad;
        v.coste = nuevoCoste;
      }
      return c.id;
    });
    refrescarStock();
    return { ok: t("Compra registrada. El stock ya está actualizado."), id };
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
}

export async function anularCompra(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const t = await traductor();
  const id = entero(fd, "id");
  if (!id) return { error: t("Compra no válida.") };
  if (fd.get("confirmar") !== "on") return { error: t("Marca la casilla para confirmar.") };
  try {
    await db.transaction(async (tx) => {
      const [c] = await tx.select().from(compras).where(eq(compras.id, id)).for("update");
      if (!c) throw new Error(t("La compra no existe."));
      if (c.anulada) throw new Error(t("Esta compra ya estaba anulada."));
      const lineas = await tx.select().from(lineasCompra).where(eq(lineasCompra.compraId, id));
      const estado = await bloquearVariantes(tx, lineas.map((l) => l.varianteId), undefined, t);

      // Comprobamos antes de tocar nada que hay unidades suficientes para retirar
      const porVariante = new Map<number, number>();
      for (const l of lineas) porVariante.set(l.varianteId, (porVariante.get(l.varianteId) ?? 0) + l.cantidad);
      for (const [vid, cant] of porVariante) {
        const v = estado.get(vid)!;
        if (v.stock < cant) {
          throw new Error(
            t('No se puede anular: de "{nombre}" solo quedan {stock} y la compra metió {cantidad}. Ajusta el stock primero si hace falta.', {
              nombre: v.nombre,
              stock: v.stock,
              cantidad: cant,
            }),
          );
        }
      }

      // Las otras compras no anuladas de estos productos, la más reciente primero (para recalcular el coste)
      const otras = await tx
        .select({ varianteId: lineasCompra.varianteId, cantidad: lineasCompra.cantidad, costeReal: lineasCompra.costeReal })
        .from(lineasCompra)
        .innerJoin(compras, eq(compras.id, lineasCompra.compraId))
        .where(and(inArray(lineasCompra.varianteId, [...porVariante.keys()]), ne(lineasCompra.compraId, id), eq(compras.anulada, false)))
        .orderBy(desc(lineasCompra.id));
      // Productos con unidades metidas por ajuste (su coste puede quedar por debajo del de cualquier compra)
      const conAjustes = new Set(
        (
          await tx
            .selectDistinct({ varianteId: movimientosStock.varianteId })
            .from(movimientosStock)
            .where(
              and(
                inArray(movimientosStock.varianteId, [...porVariante.keys()]),
                eq(movimientosStock.tipo, "ajuste"),
                gt(movimientosStock.cantidad, 0),
              ),
            )
        ).map((m) => m.varianteId),
      );

      for (const l of lineas) {
        const v = estado.get(l.varianteId)!;
        const restante = v.stock - l.cantidad;
        const coste = costeTrasAnularCompra(
          v.stock,
          v.coste,
          l.cantidad,
          Number(l.costeReal),
          otras.filter((o) => o.varianteId === l.varianteId).map((o) => ({ cantidad: o.cantidad, costeReal: Number(o.costeReal) })),
          conAjustes.has(l.varianteId),
        );
        await tx.insert(movimientosStock).values({
          varianteId: l.varianteId,
          tipo: "anulacion_compra",
          cantidad: -l.cantidad,
          compraId: id,
        });
        await tx.update(variantes).set({ costeMedio: coste.toFixed(4) }).where(eq(variantes.id, l.varianteId));
        v.stock = restante;
        v.coste = coste;
      }
      await tx.update(compras).set({ anulada: true, anuladaEn: new Date() }).where(eq(compras.id, id));
    });
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescarStock();
  return { ok: t("Compra anulada y stock retirado.") };
}

// ======================= VENTAS =======================

export type VentaInput = {
  lineas: { varianteId: number; cantidad: number }[];
  metodoPago: string;
  descuento: number;
  mayorEdad: boolean;
  notas?: string | null;
  // Si se cobra una reserva: sus unidades no cuentan como apartadas y la reserva queda vendida
  reservaId?: number | null;
  // La crea el TPV para cada ticket: si se corta la conexión y se vuelve a cobrar, no se guarda dos veces
  clave?: string | null;
  // Total que enseña el TPV: si los precios han cambiado desde entonces, no se cobra
  totalEsperado?: number | null;
};

// Por qué no se puede cobrar una reserva que ya no está activa (el estado viene de la base de datos)
const RESERVA_CERRADA: Record<string, string> = {
  vendida: tx("Esa reserva ya está vendida. Quita la reserva del ticket para vender sin ella."),
  rechazada: tx("Esa reserva ya está rechazada. Quita la reserva del ticket para vender sin ella."),
  cancelada: tx("Esa reserva ya está cancelada. Quita la reserva del ticket para vender sin ella."),
};
const RESERVA_NO_ACTIVA = tx("Esa reserva ya no está activa. Quita la reserva del ticket para vender sin ella.");

// Venta ya guardada con esa clave (un cobro repetido)
async function ventaConClave(q: Tx | typeof db, clave: string) {
  const [v] = await q.select({ id: ventas.id, total: ventas.total }).from(ventas).where(eq(ventas.clave, clave));
  return v ? { id: v.id, total: Number(v.total) } : null;
}

export async function crearVenta(input: VentaInput): Promise<Resultado & { total?: number; repetida?: boolean }> {
  await exigirSesion();
  const t = await traductor();
  const clave = typeof input.clave === "string" && /^[A-Za-z0-9-]{8,64}$/.test(input.clave) ? input.clave : null;
  try {
    if (input.clave != null && !clave) throw new Error(tx("Clave de cobro no válida."));
    if (input.totalEsperado != null && !Number.isFinite(input.totalEsperado)) throw new Error(tx("Total no válido."));
    if (!input.mayorEdad) throw new Error(tx("Confirma que has comprobado que el cliente es mayor de edad."));
    if (!valores(METODOS_PAGO).includes(input.metodoPago)) throw new Error(tx("Elige cómo paga el cliente."));
    // Juntamos líneas repetidas del mismo producto
    const cant = new Map<number, number>();
    for (const l of input.lineas) {
      if (!Number.isInteger(l.cantidad) || l.cantidad <= 0) throw new Error(tx("Cantidades no válidas."));
      cant.set(l.varianteId, (cant.get(l.varianteId) ?? 0) + l.cantidad);
    }
    if (cant.size === 0) throw new Error(tx("El ticket está vacío."));

    const res = await db.transaction(async (tx) => {
      // Reintento de un cobro que ya se guardó (se perdió la respuesta): devolvemos esa venta sin tocar nada
      const previa = clave ? await ventaConClave(tx, clave) : null;
      if (previa) return { ...previa, repetida: true };
      const reservaId = input.reservaId || null;
      if (reservaId) {
        const [r] = (await tx.execute(
          sql`select estado from reservas where id = ${reservaId} for update`,
        )) as unknown as { estado: string }[];
        if (!r) throw new Error(t("La reserva no existe."));
        if (r.estado !== "pendiente" && r.estado !== "confirmada") {
          throw new Error(t(RESERVA_CERRADA[r.estado] ?? RESERVA_NO_ACTIVA));
        }
      }
      const estado = await bloquearVariantes(tx, [...cant.keys()], reservaId, t);
      let subtotal = 0;
      for (const [vid, c] of cant) {
        const v = estado.get(vid)!;
        if (!v.activo) throw new Error(t('"{nombre}" está desactivado.', { nombre: v.nombre }));
        if (v.precio <= 0) throw new Error(t('"{nombre}" no tiene precio de venta. Pónselo en Catálogo.', { nombre: v.nombre }));
        const libres = v.stock - v.reservado;
        if (libres < c) {
          throw new Error(
            v.stock <= 0
              ? t('No queda stock de "{nombre}". Registra la compra o ajusta el inventario.', { nombre: v.nombre })
              : v.reservado > 0
                ? t('De "{nombre}" quedan {stock}, pero {reservado} están apartadas en reservas.', {
                    nombre: v.nombre,
                    stock: v.stock,
                    reservado: v.reservado,
                  })
                : v.stock === 1
                  ? t('De "{nombre}" solo queda 1.', { nombre: v.nombre })
                  : t('De "{nombre}" solo quedan {stock}.', { nombre: v.nombre, stock: v.stock }),
          );
        }
        subtotal += c * v.precio;
      }
      subtotal = redondear(subtotal);
      const descuento = redondear(Math.min(Math.max(input.descuento || 0, 0), subtotal));
      const total = redondear(subtotal - descuento);
      // Se cobra lo que enseña el TPV: si los precios han cambiado mientras estaba abierto, que lo revise
      if (input.totalEsperado != null && Math.abs(total - input.totalEsperado) > 0.005) {
        throw new Error(
          t("Los precios han cambiado: el total ahora es {total}. Revisa el ticket y vuelve a cobrar.", { total: euros(total) }),
        );
      }

      const [ve] = await tx
        .insert(ventas)
        .values({
          // Hora real de la base de datos (no la del inicio de la transacción) para que el cierre de caja
          // nunca deje fuera una venta que se estaba guardando justo al cerrar
          fecha: sql`clock_timestamp()`,
          metodoPago: input.metodoPago,
          subtotal: subtotal.toFixed(2),
          descuento: descuento.toFixed(2),
          total: total.toFixed(2),
          mayorEdadVerificado: true,
          notas: input.notas?.trim() || null,
          clave,
        })
        .returning({ id: ventas.id });

      for (const [vid, c] of cant) {
        const v = estado.get(vid)!;
        await tx.insert(lineasVenta).values({
          ventaId: ve.id,
          varianteId: vid,
          cantidad: c,
          precioUnidad: v.precio.toFixed(2),
          costeUnidad: v.coste.toFixed(4),
        });
        await tx.insert(movimientosStock).values({ varianteId: vid, tipo: "venta", cantidad: -c, ventaId: ve.id });
      }
      if (reservaId) {
        await tx.execute(
          sql`update reservas set estado = 'vendida', venta_id = ${ve.id}, cerrada_en = now() where id = ${reservaId}`,
        );
      }
      return { id: ve.id, total, repetida: false };
    });
    refrescarStock();
    return { ok: t("Venta registrada."), id: res.id, total: res.total, repetida: res.repetida };
  } catch (e) {
    // Dos peticiones del mismo cobro a la vez: la que pierde choca con la clave única (23505) o ya no encuentra
    // libres el stock o la reserva. Si la otra ya está guardada, es el mismo cobro: devolvemos esa venta.
    const previa = clave ? await ventaConClave(db, clave).catch(() => null) : null;
    if (previa) {
      refrescarStock();
      return { ok: t("Venta registrada."), ...previa, repetida: true };
    }
    return { error: mensajeError(e, t) };
  }
}

export async function anularVenta(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const t = await traductor();
  const id = entero(fd, "id");
  if (!id) return { error: t("Venta no válida.") };
  if (fd.get("confirmar") !== "on") return { error: t("Marca la casilla para confirmar.") };
  try {
    await db.transaction(async (tx) => {
      const [ve] = await tx.select().from(ventas).where(eq(ventas.id, id)).for("update");
      if (!ve) throw new Error(t("La venta no existe."));
      if (ve.anulada) throw new Error(t("Esta venta ya estaba anulada."));
      const [dev] = await tx.select({ id: devoluciones.id }).from(devoluciones).where(eq(devoluciones.ventaId, id)).limit(1);
      if (dev) {
        throw new Error(
          t("Esta venta ya tiene devoluciones y no se puede anular. Si te devuelven el resto, regístralo como otra devolución."),
        );
      }
      const lineas = await tx.select().from(lineasVenta).where(eq(lineasVenta.ventaId, id));
      const estado = await bloquearVariantes(tx, lineas.map((l) => l.varianteId), undefined, t);
      for (const l of lineas) {
        const v = estado.get(l.varianteId)!;
        const coste = costeTrasEntrada(v.stock, v.coste, l.cantidad, Number(l.costeUnidad));
        await tx.insert(movimientosStock).values({
          varianteId: l.varianteId,
          tipo: "anulacion_venta",
          cantidad: l.cantidad,
          ventaId: id,
        });
        await tx.update(variantes).set({ costeMedio: coste.toFixed(4) }).where(eq(variantes.id, l.varianteId));
        v.stock += l.cantidad;
        v.coste = coste;
      }
      // La hora de anulación decide en qué cierre de caja sale el dinero devuelto
      await tx.update(ventas).set({ anulada: true, anuladaEn: sql`clock_timestamp()` }).where(eq(ventas.id, id));
    });
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
  refrescarStock();
  return { ok: t("Venta anulada. Las unidades han vuelto al stock.") };
}

// ======================= DEVOLUCIONES =======================

export type DevolucionInput = {
  ventaId: number;
  lineas: { lineaVentaId: number; cantidad: number }[];
  metodoPago: string;
  vuelveAlStock: boolean;
  motivo?: string | null;
};

export async function crearDevolucion(input: DevolucionInput): Promise<Resultado & { total?: number }> {
  await exigirSesion();
  const t = await traductor();
  try {
    if (!valores(METODOS_PAGO).includes(input.metodoPago)) throw new Error(tx("Elige cómo devuelves el dinero."));
    if (typeof input.vuelveAlStock !== "boolean") throw new Error(tx("Elige si las unidades vuelven al stock."));
    const pedidas = new Map<number, number>();
    for (const l of input.lineas) {
      if (!Number.isInteger(l.cantidad) || l.cantidad < 0) throw new Error(tx("Cantidades no válidas."));
      if (l.cantidad > 0) pedidas.set(l.lineaVentaId, (pedidas.get(l.lineaVentaId) ?? 0) + l.cantidad);
    }
    if (pedidas.size === 0) throw new Error(tx("Elige qué unidades te devuelven."));

    const res = await db.transaction(async (tx) => {
      const [ve] = await tx.select().from(ventas).where(eq(ventas.id, input.ventaId)).for("update");
      if (!ve) throw new Error(t("La venta no existe."));
      if (ve.anulada) throw new Error(t("La venta está anulada: no se puede devolver nada."));

      const lineas = (await tx.execute(sql`
        select l.id, l.variante_id as "varianteId", l.cantidad, l.precio_unidad as "precioUnidad", l.coste_unidad as "costeUnidad",
               coalesce((select sum(ld.cantidad) from lineas_devolucion ld where ld.linea_venta_id = l.id), 0)::int as devueltas
        from lineas_venta l where l.venta_id = ${ve.id} order by l.id
      `)) as unknown as { id: number; varianteId: number; cantidad: number; precioUnidad: string; costeUnidad: string; devueltas: number }[];
      const [{ ya }] = (await tx.execute(
        sql`select coalesce(sum(importe), 0) as ya from devoluciones where venta_id = ${ve.id}`,
      )) as unknown as { ya: string }[];

      for (const [lid, cant] of pedidas) {
        const l = lineas.find((x) => x.id === lid);
        if (!l) throw new Error(t("Esa línea no es de esta venta."));
        const quedan = l.cantidad - l.devueltas;
        if (cant > quedan) {
          throw new Error(
            quedan === 1
              ? t("De una de las líneas solo queda 1 por devolver.")
              : t("De una de las líneas solo quedan {n} por devolver.", { n: quedan }),
          );
        }
      }

      const { porLinea, total } = importesDevolucion(
        { total: Number(ve.total), subtotal: Number(ve.subtotal), yaDevuelto: Number(ya) },
        lineas.map((l) => ({
          id: l.id,
          precioUnidad: Number(l.precioUnidad),
          cantidad: l.cantidad,
          devueltas: l.devueltas,
          aDevolver: pedidas.get(l.id) ?? 0,
        })),
      );

      const [d] = await tx
        .insert(devoluciones)
        .values({
          ventaId: ve.id,
          // Hora real: decide en qué cierre de caja sale el dinero
          fecha: sql`clock_timestamp()`,
          metodoPago: input.metodoPago,
          importe: total.toFixed(2),
          vuelveAlStock: input.vuelveAlStock,
          motivo: input.motivo?.trim() || null,
        })
        .returning({ id: devoluciones.id });

      const elegidas = lineas.filter((l) => pedidas.has(l.id));
      const estado = input.vuelveAlStock ? await bloquearVariantes(tx, elegidas.map((l) => l.varianteId), undefined, t) : null;
      for (const l of elegidas) {
        const cant = pedidas.get(l.id)!;
        await tx.insert(lineasDevolucion).values({
          devolucionId: d.id,
          lineaVentaId: l.id,
          varianteId: l.varianteId,
          cantidad: cant,
          importe: (porLinea.get(l.id) ?? 0).toFixed(2),
          costeUnidad: l.costeUnidad,
        });
        if (estado) {
          // Vuelve a estar a la venta al coste que tenía cuando se vendió
          const v = estado.get(l.varianteId)!;
          const coste = costeTrasEntrada(v.stock, v.coste, cant, Number(l.costeUnidad));
          await tx.insert(movimientosStock).values({
            varianteId: l.varianteId,
            tipo: "devolucion",
            cantidad: cant,
            motivo: input.motivo?.trim() || null,
            ventaId: ve.id,
          });
          await tx.update(variantes).set({ costeMedio: coste.toFixed(4) }).where(eq(variantes.id, l.varianteId));
          v.stock += cant;
          v.coste = coste;
        }
      }
      return { id: d.id, total };
    });
    refrescarStock();
    return { ok: t("Devolución registrada."), id: res.id, total: res.total };
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
}

// ======================= AJUSTES DE INVENTARIO =======================

export async function ajustarStock(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const t = await traductor();
  const varianteId = entero(fd, "variante_id");
  const modo = texto(fd, "modo"); // "contado" | "diferencia"
  const valor = entero(fd, "valor");
  const motivo = texto(fd, "motivo");
  const nota = texto(fd, "nota");
  if (!varianteId) return { error: t("Elige un producto.") };
  if (valor === null || Number.isNaN(valor)) return { error: t("Escribe un número entero.") };
  if (!valores(MOTIVOS_AJUSTE).includes(motivo)) return { error: t("Elige un motivo.") };
  try {
    const diff = await db.transaction(async (tx) => {
      const estado = await bloquearVariantes(tx, [varianteId], undefined, t);
      const v = estado.get(varianteId)!;
      const diferencia = modo === "contado" ? valor - v.stock : valor;
      if (modo === "contado" && valor < 0) throw new Error(t("El stock contado no puede ser negativo."));
      if (diferencia === 0) throw new Error(t("No hay nada que ajustar: el stock ya es ese."));
      if (v.stock + diferencia < 0) {
        throw new Error(
          v.stock === 1
            ? t("Solo hay 1 unidad; no puedes quitar {cantidad}.", { cantidad: -diferencia })
            : t("Solo hay {stock} unidades; no puedes quitar {cantidad}.", { stock: v.stock, cantidad: -diferencia }),
        );
      }
      await tx.insert(movimientosStock).values({
        varianteId,
        tipo: "ajuste",
        cantidad: diferencia,
        // Se guarda en la base de datos: el motivo queda en castellano
        motivo: [etiqueta(MOTIVOS_AJUSTE, motivo), nota].filter(Boolean).join(" — "),
      });
      return diferencia;
    });
    refrescarStock();
    return { ok: t("Ajuste guardado ({cantidad} uds.).", { cantidad: `${diff > 0 ? "+" : ""}${diff}` }) };
  } catch (e) {
    return { error: mensajeError(e, t) };
  }
}
