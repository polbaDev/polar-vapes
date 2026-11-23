CREATE TABLE "cierres_caja" (
	"id" serial PRIMARY KEY NOT NULL,
	"desde" timestamp with time zone NOT NULL,
	"hasta" timestamp with time zone NOT NULL,
	"fondo_inicial" numeric(10, 2) NOT NULL,
	"ventas_efectivo" numeric(12, 2) NOT NULL,
	"devoluciones_efectivo" numeric(12, 2) NOT NULL,
	"entradas" numeric(12, 2) NOT NULL,
	"salidas" numeric(12, 2) NOT NULL,
	"esperado" numeric(12, 2) NOT NULL,
	"contado" numeric(12, 2) NOT NULL,
	"descuadre" numeric(12, 2) NOT NULL,
	"fondo_siguiente" numeric(10, 2) NOT NULL,
	"ventas_tarjeta" numeric(12, 2) NOT NULL,
	"ventas_bizum" numeric(12, 2) NOT NULL,
	"tickets" integer NOT NULL,
	"notas" text,
	CONSTRAINT "cierres_caja_importes_ck" CHECK ("cierres_caja"."contado" >= 0 and "cierres_caja"."fondo_siguiente" >= 0 and "cierres_caja"."fondo_siguiente" <= "cierres_caja"."contado")
);
--> statement-breakpoint
CREATE TABLE "movimientos_caja" (
	"id" serial PRIMARY KEY NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"tipo" text NOT NULL,
	"importe" numeric(10, 2) NOT NULL,
	"motivo" text NOT NULL,
	CONSTRAINT "movimientos_caja_importe_ck" CHECK ("movimientos_caja"."importe" > 0),
	CONSTRAINT "movimientos_caja_tipo_ck" CHECK ("movimientos_caja"."tipo" in ('entrada', 'salida'))
);
--> statement-breakpoint
CREATE INDEX "cierres_caja_hasta_idx" ON "cierres_caja" USING btree ("hasta");--> statement-breakpoint
CREATE INDEX "movimientos_caja_fecha_idx" ON "movimientos_caja" USING btree ("fecha");