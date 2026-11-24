CREATE TABLE "movimientos_socios" (
	"id" serial PRIMARY KEY NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"tipo" text NOT NULL,
	"de_id" integer,
	"para_id" integer,
	"importe" numeric(12, 2) NOT NULL,
	"motivo" text,
	"usuario_id" integer,
	"anulado" boolean DEFAULT false NOT NULL,
	"anulado_en" timestamp with time zone,
	"anulado_por_id" integer,
	CONSTRAINT "movimientos_socios_tipo_ck" CHECK ("movimientos_socios"."tipo" in ('pago', 'gasto', 'reparto', 'ajuste')),
	CONSTRAINT "movimientos_socios_importe_ck" CHECK ("movimientos_socios"."importe" > 0),
	CONSTRAINT "movimientos_socios_partes_ck" CHECK (("movimientos_socios"."de_id" is not null or "movimientos_socios"."para_id" is not null) and "movimientos_socios"."de_id" is distinct from "movimientos_socios"."para_id")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"clave" text NOT NULL,
	"socio" boolean DEFAULT true NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"sesion_version" integer DEFAULT 0 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cierres_caja" ADD COLUMN "usuario_id" integer;--> statement-breakpoint
ALTER TABLE "cierres_caja" ADD COLUMN "recibe_id" integer;--> statement-breakpoint
ALTER TABLE "compras" ADD COLUMN "usuario_id" integer;--> statement-breakpoint
ALTER TABLE "compras" ADD COLUMN "paga_id" integer;--> statement-breakpoint
ALTER TABLE "compras" ADD COLUMN "anulada_por_id" integer;--> statement-breakpoint
ALTER TABLE "devoluciones" ADD COLUMN "usuario_id" integer;--> statement-breakpoint
ALTER TABLE "devoluciones" ADD COLUMN "paga_id" integer;--> statement-breakpoint
ALTER TABLE "movimientos_caja" ADD COLUMN "usuario_id" integer;--> statement-breakpoint
ALTER TABLE "movimientos_caja" ADD COLUMN "socio_id" integer;--> statement-breakpoint
ALTER TABLE "movimientos_stock" ADD COLUMN "usuario_id" integer;--> statement-breakpoint
ALTER TABLE "ventas" ADD COLUMN "usuario_id" integer;--> statement-breakpoint
ALTER TABLE "ventas" ADD COLUMN "recibe_id" integer;--> statement-breakpoint
ALTER TABLE "ventas" ADD COLUMN "anulada_por_id" integer;--> statement-breakpoint
ALTER TABLE "movimientos_socios" ADD CONSTRAINT "movimientos_socios_de_id_usuarios_id_fk" FOREIGN KEY ("de_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_socios" ADD CONSTRAINT "movimientos_socios_para_id_usuarios_id_fk" FOREIGN KEY ("para_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_socios" ADD CONSTRAINT "movimientos_socios_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_socios" ADD CONSTRAINT "movimientos_socios_anulado_por_id_usuarios_id_fk" FOREIGN KEY ("anulado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "movimientos_socios_fecha_idx" ON "movimientos_socios" USING btree ("fecha");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_nombre_uq" ON "usuarios" USING btree (lower("nombre"));--> statement-breakpoint
ALTER TABLE "cierres_caja" ADD CONSTRAINT "cierres_caja_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cierres_caja" ADD CONSTRAINT "cierres_caja_recibe_id_usuarios_id_fk" FOREIGN KEY ("recibe_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras" ADD CONSTRAINT "compras_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras" ADD CONSTRAINT "compras_paga_id_usuarios_id_fk" FOREIGN KEY ("paga_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras" ADD CONSTRAINT "compras_anulada_por_id_usuarios_id_fk" FOREIGN KEY ("anulada_por_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_paga_id_usuarios_id_fk" FOREIGN KEY ("paga_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_socio_id_usuarios_id_fk" FOREIGN KEY ("socio_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_recibe_id_usuarios_id_fk" FOREIGN KEY ("recibe_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_anulada_por_id_usuarios_id_fk" FOREIGN KEY ("anulada_por_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ventas_usuario_idx" ON "ventas" USING btree ("usuario_id");