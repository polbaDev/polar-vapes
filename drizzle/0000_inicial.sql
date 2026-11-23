CREATE TABLE "compras" (
	"id" serial PRIMARY KEY NOT NULL,
	"proveedor_id" integer,
	"fecha" date NOT NULL,
	"num_factura" text,
	"gastos_envio" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"notas" text,
	"anulada" boolean DEFAULT false NOT NULL,
	"anulada_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lineas_compra" (
	"id" serial PRIMARY KEY NOT NULL,
	"compra_id" integer NOT NULL,
	"variante_id" integer NOT NULL,
	"cantidad" integer NOT NULL,
	"coste_unidad" numeric(12, 4) NOT NULL,
	"coste_real" numeric(12, 4) NOT NULL,
	"lote" text,
	CONSTRAINT "lineas_compra_cantidad_ck" CHECK ("lineas_compra"."cantidad" > 0)
);
--> statement-breakpoint
CREATE TABLE "lineas_venta" (
	"id" serial PRIMARY KEY NOT NULL,
	"venta_id" integer NOT NULL,
	"variante_id" integer NOT NULL,
	"cantidad" integer NOT NULL,
	"precio_unidad" numeric(10, 2) NOT NULL,
	"coste_unidad" numeric(12, 4) NOT NULL,
	CONSTRAINT "lineas_venta_cantidad_ck" CHECK ("lineas_venta"."cantidad" > 0)
);
--> statement-breakpoint
CREATE TABLE "marcas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marcas_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "movimientos_stock" (
	"id" serial PRIMARY KEY NOT NULL,
	"variante_id" integer NOT NULL,
	"tipo" text NOT NULL,
	"cantidad" integer NOT NULL,
	"motivo" text,
	"compra_id" integer,
	"venta_id" integer,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "productos" (
	"id" serial PRIMARY KEY NOT NULL,
	"marca_id" integer NOT NULL,
	"modelo" text NOT NULL,
	"tipo" text DEFAULT 'desechable' NOT NULL,
	"caladas" integer,
	"ml" numeric(6, 1),
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proveedores" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"telefono" text,
	"email" text,
	"notas" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proveedores_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "sabores" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"categoria" text DEFAULT 'otro' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sabores_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "variantes" (
	"id" serial PRIMARY KEY NOT NULL,
	"producto_id" integer NOT NULL,
	"sabor_id" integer NOT NULL,
	"nicotina_mg" integer DEFAULT 0 NOT NULL,
	"codigo_barras" text,
	"precio_venta" numeric(10, 2) NOT NULL,
	"coste_medio" numeric(12, 4) DEFAULT '0' NOT NULL,
	"stock_minimo" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "variantes_codigo_barras_unique" UNIQUE("codigo_barras"),
	CONSTRAINT "variantes_precio_ck" CHECK ("variantes"."precio_venta" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ventas" (
	"id" serial PRIMARY KEY NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"metodo_pago" text NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"descuento" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"mayor_edad_verificado" boolean NOT NULL,
	"notas" text,
	"anulada" boolean DEFAULT false NOT NULL,
	"anulada_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "compras" ADD CONSTRAINT "compras_proveedor_id_proveedores_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineas_compra" ADD CONSTRAINT "lineas_compra_compra_id_compras_id_fk" FOREIGN KEY ("compra_id") REFERENCES "public"."compras"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineas_compra" ADD CONSTRAINT "lineas_compra_variante_id_variantes_id_fk" FOREIGN KEY ("variante_id") REFERENCES "public"."variantes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineas_venta" ADD CONSTRAINT "lineas_venta_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineas_venta" ADD CONSTRAINT "lineas_venta_variante_id_variantes_id_fk" FOREIGN KEY ("variante_id") REFERENCES "public"."variantes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_variante_id_variantes_id_fk" FOREIGN KEY ("variante_id") REFERENCES "public"."variantes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_compra_id_compras_id_fk" FOREIGN KEY ("compra_id") REFERENCES "public"."compras"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_marca_id_marcas_id_fk" FOREIGN KEY ("marca_id") REFERENCES "public"."marcas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variantes" ADD CONSTRAINT "variantes_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variantes" ADD CONSTRAINT "variantes_sabor_id_sabores_id_fk" FOREIGN KEY ("sabor_id") REFERENCES "public"."sabores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lineas_compra_compra_idx" ON "lineas_compra" USING btree ("compra_id");--> statement-breakpoint
CREATE INDEX "lineas_venta_venta_idx" ON "lineas_venta" USING btree ("venta_id");--> statement-breakpoint
CREATE INDEX "lineas_venta_variante_idx" ON "lineas_venta" USING btree ("variante_id");--> statement-breakpoint
CREATE INDEX "movimientos_variante_idx" ON "movimientos_stock" USING btree ("variante_id");--> statement-breakpoint
CREATE UNIQUE INDEX "productos_marca_modelo_uq" ON "productos" USING btree ("marca_id","modelo");--> statement-breakpoint
CREATE UNIQUE INDEX "variantes_producto_sabor_nic_uq" ON "variantes" USING btree ("producto_id","sabor_id","nicotina_mg");--> statement-breakpoint
CREATE INDEX "ventas_fecha_idx" ON "ventas" USING btree ("fecha");