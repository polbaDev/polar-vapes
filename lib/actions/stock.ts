"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db, type Tx } from "@/lib/db";
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
import { importesDevolucion } from "@/lib/devolucion-calculo";
import { exigirSesion } from "@/lib/session";
import { METODOS_PAGO, MOTIVOS_AJUSTE, valores, etiqueta } from "@/lib/constants";
import { redondear } from "@/lib/format";
import { type Resultado, texto, entero, mensajeError } from "./tipos";

function refrescarStock() {
  revalidatePath("/", "layout");
}

// Bloquea las variantes (en orden, para evitar bloqueos cruzados) y devuelve stock y coste actuales.
async function bloquearVariantes(tx: Tx, ids: number[]) {
  const unicos = [...new Set(ids)].sort((a, b) => a - b);
  if (unicos.length === 0) return new Map<number, { stock: number; coste: number; precio: number; activo: boolean; nombre: string }>();
  const lista = sql.join(unicos.map((i) => sql`${i}`), sql`, `);
  await tx.execute(sql`select id from variantes where id in (${lista}) order by id for update`);
  const rows = (await tx.execute(sql`
    select v.id, v.coste_medio as coste, v.precio_venta as precio, (v.activo and p.activo) as activo,
           ma.nombre || ' ' || p.modelo || ' · ' || s.nombre || ' · ' || v.nicotina_mg || ' mg' as nombre,
           coalesce((select sum(m.cantidad) from movimientos_stock m where m.variante_id = v.id), 0)::int as stock
    from variantes v
    join productos p on p.id = v.producto_id
    join marcas ma on ma.id = p.marca_id
    join sabores s on s.id = v.sabor_id
    where v.id in (${lista})
  `)) as unknown as { id: number; coste: string; precio: string; activo: boolean; nombre: string; stock: number }[];
  const mapa = new Map<number, { stock: number; coste: number; precio: number; activo: boolean; nombre: string }>();
  for (const r of rows) {
    mapa.set(r.id, { stock: r.stock, coste: Number(r.coste), precio: Number(r.precio), activo: r.activo, nombre: r.nombre });
  }
  for (const id of unicos) if (!mapa.has(id)) throw new Error(`El producto #${id} no existe.`);
  return mapa;
}

// Coste medio ponderado al entrar unidades
function costeTrasEntrada(stock: number, coste: number, cantidad: number, costeEntrada: number) {
  const base = Math.max(stock, 0);
  if (base + cantidad <= 0) return costeEntrada;
  return (base * coste + cantidad * costeEntrada) / (base + cantidad);
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
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) throw new Error("Fecha no válida.");
    const lineas = input.lineas.filter((l) => l.varianteId);
    if (lineas.length === 0) throw new Error("Añade al menos un producto a la compra.");
    for (const l of lineas) {
      if (!Number.isInteger(l.cantidad) || l.cantidad <= 0) throw new Error("Las cantidades deben ser números enteros mayores que 0.");
      if (!Number.isFinite(l.costeUnidad) || l.costeUnidad < 0) throw new Error("Revisa los costes por unidad.");
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

      const estado = await bloquearVariantes(tx, lineas.map((l) => l.varianteId));

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
    return { ok: "Compra registrada. El stock ya está actualizado.", id };
  } catch (e) {
    return { error: mensajeError(e) };
  }
}

export async function anularCompra(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const id = entero(fd, "id");
  if (!id) return { error: "Compra no válida." };
  if (fd.get("confirmar") !== "on") return { error: "Marca la casilla para confirmar." };
  try {
    await db.transaction(async (tx) => {
      const [c] = await tx.select().from(compras).where(eq(compras.id, id)).for("update");
      if (!c) throw new Error("La compra no existe.");
      if (c.anulada) throw new Error("Esta compra ya estaba anulada.");
      const lineas = await tx.select().from(lineasCompra).where(eq(lineasCompra.compraId, id));
      const estado = await bloquearVariantes(tx, lineas.map((l) => l.varianteId));

      // Comprobamos antes de tocar nada que hay unidades suficientes para retirar
      const porVariante = new Map<number, number>();
      for (const l of lineas) porVariante.set(l.varianteId, (porVariante.get(l.varianteId) ?? 0) + l.cantidad);
      for (const [vid, cant] of porVariante) {
        const v = estado.get(vid)!;
        if (v.stock < cant) {
          throw new Error(
            `No se puede anular: de "${v.nombre}" solo quedan ${v.stock} y la compra metió ${cant}. Ajusta el stock primero si hace falta.`,
          );
        }
      }

      for (const l of lineas) {
        const v = estado.get(l.varianteId)!;
        const restante = v.stock - l.cantidad;
        const coste =
          restante > 0 ? Math.max((v.stock * v.coste - l.cantidad * Number(l.costeReal)) / restante, 0) : v.coste;
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
    return { error: mensajeError(e) };
  }
  refrescarStock();
  return { ok: "Compra anulada y stock retirado." };
}

// ======================= VENTAS =======================

export type VentaInput = {
  lineas: { varianteId: number; cantidad: number }[];
  metodoPago: string;
  descuento: number;
  mayorEdad: boolean;
  notas?: string | null;
};

export async function crearVenta(input: VentaInput): Promise<Resultado & { total?: number }> {
  await exigirSesion();
  try {
    if (!input.mayorEdad) throw new Error("Confirma que has comprobado que el cliente es mayor de edad.");
    if (!valores(METODOS_PAGO).includes(input.metodoPago)) throw new Error("Elige cómo paga el cliente.");
    // Juntamos líneas repetidas del mismo producto
    const cant = new Map<number, number>();
    for (const l of input.lineas) {
      if (!Number.isInteger(l.cantidad) || l.cantidad <= 0) throw new Error("Cantidades no válidas.");
      cant.set(l.varianteId, (cant.get(l.varianteId) ?? 0) + l.cantidad);
    }
    if (cant.size === 0) throw new Error("El ticket está vacío.");

    const res = await db.transaction(async (tx) => {
      const estado = await bloquearVariantes(tx, [...cant.keys()]);
      let subtotal = 0;
      for (const [vid, c] of cant) {
        const v = estado.get(vid)!;
        if (!v.activo) throw new Error(`"${v.nombre}" está desactivado.`);
        if (v.precio <= 0) throw new Error(`"${v.nombre}" no tiene precio de venta. Pónselo en Catálogo.`);
        if (v.stock < c) {
          throw new Error(
            v.stock <= 0
              ? `No queda stock de "${v.nombre}". Registra la compra o ajusta el inventario.`
              : `De "${v.nombre}" solo quedan ${v.stock}.`,
          );
        }
        subtotal += c * v.precio;
      }
      subtotal = redondear(subtotal);
      const descuento = redondear(Math.min(Math.max(input.descuento || 0, 0), subtotal));
      const total = redondear(subtotal - descuento);

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
      return { id: ve.id, total };
    });
    refrescarStock();
    return { ok: "Venta registrada.", id: res.id, total: res.total };
  } catch (e) {
    return { error: mensajeError(e) };
  }
}

export async function anularVenta(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const id = entero(fd, "id");
  if (!id) return { error: "Venta no válida." };
  if (fd.get("confirmar") !== "on") return { error: "Marca la casilla para confirmar." };
  try {
    await db.transaction(async (tx) => {
      const [ve] = await tx.select().from(ventas).where(eq(ventas.id, id)).for("update");
      if (!ve) throw new Error("La venta no existe.");
      if (ve.anulada) throw new Error("Esta venta ya estaba anulada.");
      const [dev] = await tx.select({ id: devoluciones.id }).from(devoluciones).where(eq(devoluciones.ventaId, id)).limit(1);
      if (dev) {
        throw new Error("Esta venta ya tiene devoluciones y no se puede anular. Si te devuelven el resto, regístralo como otra devolución.");
      }
      const lineas = await tx.select().from(lineasVenta).where(eq(lineasVenta.ventaId, id));
      const estado = await bloquearVariantes(tx, lineas.map((l) => l.varianteId));
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
    return { error: mensajeError(e) };
  }
  refrescarStock();
  return { ok: "Venta anulada. Las unidades han vuelto al stock." };
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
  try {
    if (!valores(METODOS_PAGO).includes(input.metodoPago)) throw new Error("Elige cómo devuelves el dinero.");
    if (typeof input.vuelveAlStock !== "boolean") throw new Error("Elige si las unidades vuelven al stock.");
    const pedidas = new Map<number, number>();
    for (const l of input.lineas) {
      if (!Number.isInteger(l.cantidad) || l.cantidad < 0) throw new Error("Cantidades no válidas.");
      if (l.cantidad > 0) pedidas.set(l.lineaVentaId, (pedidas.get(l.lineaVentaId) ?? 0) + l.cantidad);
    }
    if (pedidas.size === 0) throw new Error("Elige qué unidades te devuelven.");

    const res = await db.transaction(async (tx) => {
      const [ve] = await tx.select().from(ventas).where(eq(ventas.id, input.ventaId)).for("update");
      if (!ve) throw new Error("La venta no existe.");
      if (ve.anulada) throw new Error("La venta está anulada: no se puede devolver nada.");

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
        if (!l) throw new Error("Esa línea no es de esta venta.");
        if (cant > l.cantidad - l.devueltas) {
          throw new Error(`De una de las líneas solo quedan ${l.cantidad - l.devueltas} por devolver.`);
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
      const estado = input.vuelveAlStock ? await bloquearVariantes(tx, elegidas.map((l) => l.varianteId)) : null;
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
    return { ok: "Devolución registrada.", id: res.id, total: res.total };
  } catch (e) {
    return { error: mensajeError(e) };
  }
}

// ======================= AJUSTES DE INVENTARIO =======================

export async function ajustarStock(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  const varianteId = entero(fd, "variante_id");
  const modo = texto(fd, "modo"); // "contado" | "diferencia"
  const valor = entero(fd, "valor");
  const motivo = texto(fd, "motivo");
  const nota = texto(fd, "nota");
  if (!varianteId) return { error: "Elige un producto." };
  if (valor === null || Number.isNaN(valor)) return { error: "Escribe un número entero." };
  if (!valores(MOTIVOS_AJUSTE).includes(motivo)) return { error: "Elige un motivo." };
  try {
    const diff = await db.transaction(async (tx) => {
      const estado = await bloquearVariantes(tx, [varianteId]);
      const v = estado.get(varianteId)!;
      const diferencia = modo === "contado" ? valor - v.stock : valor;
      if (modo === "contado" && valor < 0) throw new Error("El stock contado no puede ser negativo.");
      if (diferencia === 0) throw new Error("No hay nada que ajustar: el stock ya es ese.");
      if (v.stock + diferencia < 0) throw new Error(`Solo hay ${v.stock} unidades; no puedes quitar ${-diferencia}.`);
      await tx.insert(movimientosStock).values({
        varianteId,
        tipo: "ajuste",
        cantidad: diferencia,
        motivo: [etiqueta(MOTIVOS_AJUSTE, motivo), nota].filter(Boolean).join(" — "),
      });
      return diferencia;
    });
    refrescarStock();
    return { ok: `Ajuste guardado (${diff > 0 ? "+" : ""}${diff} uds.).` };
  } catch (e) {
    return { error: mensajeError(e) };
  }
}
