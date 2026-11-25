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

// ---------- Cuentas ----------

// Cada persona entra con su nombre y su contraseña. Lo que hace queda a su nombre (ventas, compras…).
// socio: entra en el reparto al 50 % y puede tener dinero de la tienda (Bizum a su móvil, lo que se lleva
// en efectivo, compras que paga). Una cuenta compartida de la tienda no sería socio.
// No se borran: se desactivan, y sus ventas siguen a su nombre.
export const usuarios = pgTable(
  "usuarios",
  {
    id: serial("id").primaryKey(),
    nombre: text("nombre").notNull(),
    // scrypt$N$r$p$sal$huella (ver lib/claves.ts)
    clave: text("clave").notNull(),
    socio: boolean("socio").notNull().default(true),
    activo: boolean("activo").notNull().default(true),
    // Al subirla, sus sesiones abiertas dejan de valer (cambio de contraseña, cuenta desactivada)
    sesionVersion: integer("sesion_version").notNull().default(0),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("usuarios_nombre_uq").on(sql`lower(${t.nombre})`)],
);

// Quién hizo algo o quién tiene el dinero (null en lo anterior a las cuentas)
const usuarioRef = (columna: string) => integer(columna).references(() => usuarios.id, { onDelete: "restrict" });

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
  // Quién la registró y quién la pagó (null = con dinero de la tienda: caja o cuenta común)
  usuarioId: usuarioRef("usuario_id"),
  pagaId: usuarioRef("paga_id"),
  anuladaPorId: usuarioRef("anulada_por_id"),
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
    // La crea el TPV en cada cobro: si se corta la conexión y se vuelve a cobrar, no se guarda dos veces
    clave: text("clave").unique(),
    // Quién la cobró (cuenta para sus ventas)
    usuarioId: usuarioRef("usuario_id"),
    // Socio que se queda el dinero (efectivo, Bizum a su móvil, tarjeta a su cuenta). null = sin indicar (ventas antiguas)
    recibeId: usuarioRef("recibe_id"),
    anuladaPorId: usuarioRef("anulada_por_id"),
  },
  (t) => [index("ventas_fecha_idx").on(t.fecha), index("ventas_usuario_idx").on(t.usuarioId)],
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
    usuarioId: usuarioRef("usuario_id"),
    // Socio que devuelve el dinero (en mano, por Bizum…). null = sin indicar (devoluciones antiguas)
    pagaId: usuarioRef("paga_id"),
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

// ---------- Reservas (catálogo público) ----------

// estado: pendiente | confirmada | vendida | rechazada | cancelada
// Una reserva pendiente o confirmada aparta sus unidades hasta caduca_en. Pasada esa hora se considera
// caducada sin tocar nada (no hace falta ninguna tarea programada): las unidades vuelven a estar libres.
export const reservas = pgTable(
  "reservas",
  {
    id: serial("id").primaryKey(),
    // Código que ve el cliente (R-XXXXXX). Aleatorio para que no se puedan adivinar otras reservas.
    codigo: text("codigo").notNull().unique(),
    nombre: text("nombre").notNull(),
    estado: text("estado").notNull().default("pendiente"),
    creadaEn: timestamp("creada_en", { withTimezone: true }).notNull().defaultNow(),
    caducaEn: timestamp("caduca_en", { withTimezone: true }).notNull(),
    confirmadaEn: timestamp("confirmada_en", { withTimezone: true }),
    cerradaEn: timestamp("cerrada_en", { withTimezone: true }),
    ventaId: integer("venta_id").references(() => ventas.id, { onDelete: "set null" }),
    notas: text("notas"),
    // Huella de la IP (no la IP) para limitar reservas falsas
    origen: text("origen"),
  },
  (t) => [
    index("reservas_estado_caduca_idx").on(t.estado, t.caducaEn),
    index("reservas_origen_idx").on(t.origen, t.creadaEn),
    check("reservas_estado_ck", sql`${t.estado} in ('pendiente', 'confirmada', 'vendida', 'rechazada', 'cancelada')`),
  ],
);

export const lineasReserva = pgTable(
  "lineas_reserva",
  {
    id: serial("id").primaryKey(),
    reservaId: integer("reserva_id")
      .notNull()
      .references(() => reservas.id, { onDelete: "cascade" }),
    varianteId: integer("variante_id")
      .notNull()
      .references(() => variantes.id, { onDelete: "restrict" }),
    cantidad: integer("cantidad").notNull(),
    // Precio cuando se reservó (para el mensaje y el total que ve el cliente)
    precioUnidad: numeric("precio_unidad", { precision: 10, scale: 2 }).notNull(),
  },
  (t) => [
    index("lineas_reserva_reserva_idx").on(t.reservaId),
    index("lineas_reserva_variante_idx").on(t.varianteId),
    check("lineas_reserva_cantidad_ck", sql`${t.cantidad} > 0`),
  ],
);

// Ajustes del catálogo (WhatsApp, tiempos…), como clave → valor
export const ajustes = pgTable("ajustes", {
  clave: text("clave").primaryKey(),
  valor: text("valor").notNull(),
});

// Intentos fallidos de entrar, para bloquear a quien prueba contraseñas
export const intentosLogin = pgTable(
  "intentos_login",
  {
    id: serial("id").primaryKey(),
    origen: text("origen").notNull(),
    fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("intentos_login_origen_idx").on(t.origen, t.fecha), index("intentos_login_fecha_idx").on(t.fecha)],
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
    usuarioId: usuarioRef("usuario_id"),
  },
  (t) => [index("movimientos_variante_idx").on(t.varianteId)],
);

// ---------- Dinero entre socios ----------

// Lo que mueve dinero entre los socios sin ser una venta ni una compra.
// de_id: socio cuyo saldo baja; para_id: socio cuyo saldo sube (el saldo es el dinero de la tienda que tiene,
// menos lo que ha puesto de su bolsillo).
// tipo: pago       — un socio le pasa dinero al otro (de → para)
//       gasto      — un socio paga algo de la tienda que no es stock (de)
//       reparto    — un socio se queda dinero de la tienda como ganancia (de); se apunta lo mismo a cada uno
//       ajuste     — saldo de partida: puso dinero suyo (de) o tiene dinero de la tienda (para)
//       aportacion — un socio pone dinero suyo en el bote (de) y lo guarda él mismo o el otro (para)
// No se borran: se anulan y siguen a la vista.
export const movimientosSocios = pgTable(
  "movimientos_socios",
  {
    id: serial("id").primaryKey(),
    fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
    tipo: text("tipo").notNull(),
    deId: usuarioRef("de_id"),
    paraId: usuarioRef("para_id"),
    importe: numeric("importe", { precision: 12, scale: 2 }).notNull(),
    motivo: text("motivo"),
    usuarioId: usuarioRef("usuario_id"),
    anulado: boolean("anulado").notNull().default(false),
    anuladoEn: timestamp("anulado_en", { withTimezone: true }),
    anuladoPorId: usuarioRef("anulado_por_id"),
  },
  (t) => [
    index("movimientos_socios_fecha_idx").on(t.fecha),
    check("movimientos_socios_tipo_ck", sql`${t.tipo} in ('pago', 'gasto', 'reparto', 'ajuste', 'aportacion')`),
    check("movimientos_socios_importe_ck", sql`${t.importe} > 0`),
    check("movimientos_socios_partes_ck", sql`(${t.deId} is not null or ${t.paraId} is not null) and (${t.deId} is distinct from ${t.paraId} or ${t.tipo} = 'aportacion')`),
  ],
);
