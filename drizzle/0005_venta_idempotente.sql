ALTER TABLE "ventas" ADD COLUMN "clave" text;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_clave_unique" UNIQUE("clave");