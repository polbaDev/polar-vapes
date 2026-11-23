CREATE TABLE "ajustes" (
	"clave" text PRIMARY KEY NOT NULL,
	"valor" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intentos_login" (
	"id" serial PRIMARY KEY NOT NULL,
	"origen" text NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lineas_reserva" (
	"id" serial PRIMARY KEY NOT NULL,
	"reserva_id" integer NOT NULL,
	"variante_id" integer NOT NULL,
	"cantidad" integer NOT NULL,
	"precio_unidad" numeric(10, 2) NOT NULL,
	CONSTRAINT "lineas_reserva_cantidad_ck" CHECK ("lineas_reserva"."cantidad" > 0)
);
--> statement-breakpoint
CREATE TABLE "reservas" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"caduca_en" timestamp with time zone NOT NULL,
	"confirmada_en" timestamp with time zone,
	"cerrada_en" timestamp with time zone,
	"venta_id" integer,
	"notas" text,
	"origen" text,
	CONSTRAINT "reservas_codigo_unique" UNIQUE("codigo"),
	CONSTRAINT "reservas_estado_ck" CHECK ("reservas"."estado" in ('pendiente', 'confirmada', 'vendida', 'rechazada', 'cancelada'))
);
--> statement-breakpoint
ALTER TABLE "lineas_reserva" ADD CONSTRAINT "lineas_reserva_reserva_id_reservas_id_fk" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineas_reserva" ADD CONSTRAINT "lineas_reserva_variante_id_variantes_id_fk" FOREIGN KEY ("variante_id") REFERENCES "public"."variantes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "intentos_login_origen_idx" ON "intentos_login" USING btree ("origen","fecha");--> statement-breakpoint
CREATE INDEX "intentos_login_fecha_idx" ON "intentos_login" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "lineas_reserva_reserva_idx" ON "lineas_reserva" USING btree ("reserva_id");--> statement-breakpoint
CREATE INDEX "lineas_reserva_variante_idx" ON "lineas_reserva" USING btree ("variante_id");--> statement-breakpoint
CREATE INDEX "reservas_estado_caduca_idx" ON "reservas" USING btree ("estado","caduca_en");--> statement-breakpoint
CREATE INDEX "reservas_origen_idx" ON "reservas" USING btree ("origen","creada_en");