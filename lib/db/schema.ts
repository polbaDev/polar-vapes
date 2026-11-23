import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  uniqueIndex,
  index,
  check,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

// ---------- Imágenes ----------
// Se guardan en la propia base de datos: funciona igual en Docker y en Supabase/Vercel.

export const imagenes = pgTable("imagenes", {
  id: serial("id").primaryKey(),
  tipo: text("tipo").notNull(), // image/webp, image/png…
  datos: bytea("datos").notNull(),
  ancho: integer("ancho"),
  alto: integer("alto"),
  color: text("color"), // color dominante (#rrggbb) para fondos
  origen: text("origen"), // URL de donde se descargó, "subida" o "cartel"
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Catálogo ----------

export const marcas = pgTable("marcas", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull().unique(),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

// categoria: tabaco | fruta | menta | postre | bebida | otro
export const sabores = pgTable("sabores", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull().unique(),
  categoria: text("categoria").notNull().default("otro"),
  descripcion: text("descripcion"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const proveedores = pgTable("proveedores", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull().unique(),
  telefono: text("telefono"),
  email: text("email"),
  notas: text("notas"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

// tipo: desechable | pod | liquido | recambio | kit | otro
export const productos = pgTable(
  "productos",
  {
    id: serial("id").primaryKey(),
    marcaId: integer("marca_id")
      .notNull()
      .references(() => marcas.id, { onDelete: "restrict" }),
    modelo: text("modelo").notNull(),
    tipo: text("tipo").notNull().default("desechable"),
    caladas: integer("caladas"),
    ml: numeric("ml", { precision: 6, scale: 1 }),
    descripcion: text("descripcion"),
    // Una característica por línea (se muestran como etiquetas)
    caracteristicas: text("caracteristicas"),
    imagenId: integer("imagen_id").references(() => imagenes.id, { onDelete: "set null" }),
    // URL de la imagen buena en internet (para volver a intentar la descarga)
    imagenFuente: text("imagen_fuente"),
    activo: boolean("activo").notNull().default(true),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("productos_marca_modelo_uq").on(t.marcaId, t.modelo)],
);

// Variante = producto + sabor + nicotina. Aquí viven precio, coste y stock.
export const variantes = pgTable(
  "variantes",
  {
    id: serial("id").primaryKey(),
    productoId: integer("producto_id")
      .notNull()
      .references(() => productos.id, { onDelete: "restrict" }),
    saborId: integer("sabor_id")
      .notNull()
      .references(() => sabores.id, { onDelete: "restrict" }),
    nicotinaMg: integer("nicotina_mg").notNull().default(0),
    codigoBarras: text("codigo_barras").unique(),
    precioVenta: numeric("precio_venta", { precision: 10, scale: 2 }).notNull(),
    costeMedio: numeric("coste_medio", { precision: 12, scale: 4 }).notNull().default("0"),
    stockMinimo: integer("stock_minimo").notNull().default(0),
    imagenId: integer("imagen_id").references(() => imagenes.id, { onDelete: "set null" }),
    imagenFuente: text("imagen_fuente"),
    activo: boolean("activo").notNull().default(true),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("variantes_producto_sabor_nic_uq").on(t.productoId, t.saborId, t.nicotinaMg),
    check("variantes_precio_ck", sql`${t.precioVenta} >= 0`),
  ],
);

// ---------- Compras ----------

export const compras = pgTable("compras", {
  id: serial("id").primaryKey(),
  proveedorId: integer("proveedor_id").references(() => proveedores.id, { onDelete: "restrict" }),
  fecha: date("fecha").notNull(),
  numFactura: text("num_factura"),
  gastosEnvio: numeric("gastos_envio", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  notas: text("notas"),
  anulada: boolean("anulada").notNull().default(false),
  anuladaEn: timestamp("anulada_en", { withTimezone: true }),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const lineasCompra = pgTable(
  "lineas_compra",
  {
    id: serial("id").primaryKey(),
    compraId: integer("compra_id")
      .notNull()
      .references(() => compras.id, { onDelete: "cascade" }),
    varianteId: integer("variante_id")
      .notNull()
      .references(() => variantes.id, { onDelete: "restrict" }),
    cantidad: integer("cantidad").notNull(),
    // Coste por unidad según factura
    costeUnidad: numeric("coste_unidad", { precision: 12, scale: 4 }).notNull(),
    // Coste por unidad con los gastos de envío repartidos
    costeReal: numeric("coste_real", { precision: 12, scale: 4 }).notNull(),
    lote: text("lote"),
  },
  (t) => [
    index("lineas_compra_compra_idx").on(t.compraId),
    check("lineas_compra_cantidad_ck", sql`${t.cantidad} > 0`),
  ],
);

// ---------- Ventas ----------

// metodo_pago: efectivo | tarjeta | bizum
export const ventas = pgTable(
  "ventas",
  {
    id: serial("id").primaryKey(),
    fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
    metodoPago: text("metodo_pago").notNull(),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    descuento: numeric("descuento", { precision: 12, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    mayorEdadVerificado: boolean("mayor_edad_verificado").notNull(),
    notas: text("notas"),
    anulada: boolean("anulada").notNull().default(false),
    anuladaEn: timestamp("anulada_en", { withTimezone: true }),
  },
  (t) => [index("ventas_fecha_idx").on(t.fecha)],
);

export const lineasVenta = pgTable(
  "lineas_venta",
  {
    id: serial("id").primaryKey(),
    ventaId: integer("venta_id")
      .notNull()
      .references(() => ventas.id, { onDelete: "cascade" }),
    varianteId: integer("variante_id")
      .notNull()
      .references(() => variantes.id, { onDelete: "restrict" }),
    cantidad: integer("cantidad").notNull(),
    precioUnidad: numeric("precio_unidad", { precision: 10, scale: 2 }).notNull(),
    // Foto del coste medio en el momento de la venta (para que el margen no cambie después)
    costeUnidad: numeric("coste_unidad", { precision: 12, scale: 4 }).notNull(),
  },
  (t) => [
    index("lineas_venta_venta_idx").on(t.ventaId),
    index("lineas_venta_variante_idx").on(t.varianteId),
    check("lineas_venta_cantidad_ck", sql`${t.cantidad} > 0`),
  ],
);

// ---------- Devoluciones ----------

// El cliente devuelve parte de una venta. El dinero sale por metodo_pago (efectivo cuenta en la caja
// del día en que se devuelve). Si vuelve_al_stock, las unidades vuelven a estar a la venta;
// si no (defectuoso), no se tocan el stock ni el coste y su coste queda como pérdida.
export const devoluciones = pgTable(
  "devoluciones",
  {
    id: serial("id").primaryKey(),
    ventaId: integer("venta_id")
      .notNull()
      .references(() => ventas.id, { onDelete: "restrict" }),
    fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
    metodoPago: text("metodo_pago").notNull(),
    importe: numeric("importe", { precision: 12, scale: 2 }).notNull(),
    vuelveAlStock: boolean("vuelve_al_stock").notNull(),
    motivo: text("motivo"),
  },
  (t) => [
    index("devoluciones_venta_idx").on(t.ventaId),
    index("devoluciones_fecha_idx").on(t.fecha),
    check("devoluciones_importe_ck", sql`${t.importe} >= 0`),
  ],
);

export const lineasDevolucion = pgTable(
  "lineas_devolucion",
  {
    id: serial("id").primaryKey(),
    devolucionId: integer("devolucion_id")
      .notNull()
      .references(() => devoluciones.id, { onDelete: "cascade" }),
    lineaVentaId: integer("linea_venta_id")
      .notNull()
      .references(() => lineasVenta.id, { onDelete: "restrict" }),
    varianteId: integer("variante_id")
      .notNull()
      .references(() => variantes.id, { onDelete: "restrict" }),
    cantidad: integer("cantidad").notNull(),
    // Dinero devuelto por esta línea (con el descuento del ticket ya repartido)
    importe: numeric("importe", { precision: 12, scale: 2 }).notNull(),
    // Coste de la línea de venta original
    costeUnidad: numeric("coste_unidad", { precision: 12, scale: 4 }).notNull(),
  },
  (t) => [
    index("lineas_devolucion_devolucion_idx").on(t.devolucionId),
    index("lineas_devolucion_linea_venta_idx").on(t.lineaVentaId),
    check("lineas_devolucion_cantidad_ck", sql`${t.cantidad} > 0`),
  ],
);

// ---------- Caja ----------

// Cada cierre cubre desde el cierre anterior (o el inicio del día, el primero) hasta el momento de cerrar.
// Las cifras se guardan como foto de ese momento: no cambian aunque luego se anule una venta.
export const cierresCaja = pgTable(
  "cierres_caja",
  {
    id: serial("id").primaryKey(),
    desde: timestamp("desde", { withTimezone: true }).notNull(),
    hasta: timestamp("hasta", { withTimezone: true }).notNull(),
    fondoInicial: numeric("fondo_inicial", { precision: 10, scale: 2 }).notNull(),
    ventasEfectivo: numeric("ventas_efectivo", { precision: 12, scale: 2 }).notNull(),
    // Ventas en efectivo anuladas en este periodo (dinero devuelto al cliente)
    devolucionesEfectivo: numeric("devoluciones_efectivo", { precision: 12, scale: 2 }).notNull(),
    entradas: numeric("entradas", { precision: 12, scale: 2 }).notNull(),
    salidas: numeric("salidas", { precision: 12, scale: 2 }).notNull(),
    esperado: numeric("esperado", { precision: 12, scale: 2 }).notNull(),
    contado: numeric("contado", { precision: 12, scale: 2 }).notNull(),
    // contado - esperado: positivo = sobra dinero, negativo = falta
    descuadre: numeric("descuadre", { precision: 12, scale: 2 }).notNull(),
    // Efectivo que se queda en el cajón para empezar el siguiente periodo
    fondoSiguiente: numeric("fondo_siguiente", { precision: 10, scale: 2 }).notNull(),
    // Netos del periodo (ventas menos anulaciones), para comprobar con el datáfono y el móvil
    ventasTarjeta: numeric("ventas_tarjeta", { precision: 12, scale: 2 }).notNull(),
    ventasBizum: numeric("ventas_bizum", { precision: 12, scale: 2 }).notNull(),
    tickets: integer("tickets").notNull(),
    notas: text("notas"),
  },
  (t) => [
    index("cierres_caja_hasta_idx").on(t.hasta),
    check("cierres_caja_importes_ck", sql`${t.contado} >= 0 and ${t.fondoSiguiente} >= 0 and ${t.fondoSiguiente} <= ${t.contado}`),
  ],
);

// Dinero que entra o sale del cajón sin ser una venta: pagar a un repartidor, llevar al banco, poner cambio…
// tipo: entrada | salida
export const movimientosCaja = pgTable(
  "movimientos_caja",
  {
    id: serial("id").primaryKey(),
    fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
    tipo: text("tipo").notNull(),
    importe: numeric("importe", { precision: 10, scale: 2 }).notNull(),
    motivo: text("motivo").notNull(),
  },
  (t) => [
    index("movimientos_caja_fecha_idx").on(t.fecha),
    check("movimientos_caja_importe_ck", sql`${t.importe} > 0`),
    check("movimientos_caja_tipo_ck", sql`${t.tipo} in ('entrada', 'salida')`),
  ],
);

// ---------- Stock ----------

// tipo: compra | venta | ajuste | anulacion_compra | anulacion_venta | devolucion
// cantidad con signo: + entra, - sale. El stock es la suma.
export const movimientosStock = pgTable(
  "movimientos_stock",
  {
    id: serial("id").primaryKey(),
    varianteId: integer("variante_id")
      .notNull()
      .references(() => variantes.id, { onDelete: "restrict" }),
    tipo: text("tipo").notNull(),
    cantidad: integer("cantidad").notNull(),
    motivo: text("motivo"),
    compraId: integer("compra_id").references(() => compras.id, { onDelete: "set null" }),
    ventaId: integer("venta_id").references(() => ventas.id, { onDelete: "set null" }),
    fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("movimientos_variante_idx").on(t.varianteId)],
);
