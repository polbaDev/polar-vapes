CREATE TABLE "devoluciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"venta_id" integer NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"metodo_pago" text NOT NULL,
	"importe" numeric(12, 2) NOT NULL,
	"vuelve_al_stock" boolean NOT NULL,
	"motivo" text,
	CONSTRAINT "devoluciones_importe_ck" CHECK ("devoluciones"."importe" >= 0)
);
--> statement-breakpoint
CREATE TABLE "lineas_devolucion" (
	"id" serial PRIMARY KEY NOT NULL,
	"devolucion_id" integer NOT NULL,
	"linea_venta_id" integer NOT NULL,
	"variante_id" integer NOT NULL,
	"cantidad" integer NOT NULL,
	"importe" numeric(12, 2) NOT NULL,
	"coste_unidad" numeric(12, 4) NOT NULL,
	CONSTRAINT "lineas_devolucion_cantidad_ck" CHECK ("lineas_devolucion"."cantidad" > 0)
);
--> statement-breakpoint
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineas_devolucion" ADD CONSTRAINT "lineas_devolucion_devolucion_id_devoluciones_id_fk" FOREIGN KEY ("devolucion_id") REFERENCES "public"."devoluciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineas_devolucion" ADD CONSTRAINT "lineas_devolucion_linea_venta_id_lineas_venta_id_fk" FOREIGN KEY ("linea_venta_id") REFERENCES "public"."lineas_venta"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineas_devolucion" ADD CONSTRAINT "lineas_devolucion_variante_id_variantes_id_fk" FOREIGN KEY ("variante_id") REFERENCES "public"."variantes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "devoluciones_venta_idx" ON "devoluciones" USING btree ("venta_id");--> statement-breakpoint
CREATE INDEX "devoluciones_fecha_idx" ON "devoluciones" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "lineas_devolucion_devolucion_idx" ON "lineas_devolucion" USING btree ("devolucion_id");--> statement-breakpoint
CREATE INDEX "lineas_devolucion_linea_venta_idx" ON "lineas_devolucion" USING btree ("linea_venta_id");