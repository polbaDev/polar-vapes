CREATE TABLE "imagenes" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"datos" "bytea" NOT NULL,
	"ancho" integer,
	"alto" integer,
	"color" text,
	"origen" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "descripcion" text;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "caracteristicas" text;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "imagen_id" integer;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "imagen_fuente" text;--> statement-breakpoint
ALTER TABLE "sabores" ADD COLUMN "descripcion" text;--> statement-breakpoint
ALTER TABLE "variantes" ADD COLUMN "imagen_id" integer;--> statement-breakpoint
ALTER TABLE "variantes" ADD COLUMN "imagen_fuente" text;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_imagen_id_imagenes_id_fk" FOREIGN KEY ("imagen_id") REFERENCES "public"."imagenes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variantes" ADD CONSTRAINT "variantes_imagen_id_imagenes_id_fk" FOREIGN KEY ("imagen_id") REFERENCES "public"."imagenes"("id") ON DELETE set null ON UPDATE no action;