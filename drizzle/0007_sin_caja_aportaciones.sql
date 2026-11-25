-- Sin caja: el dinero siempre está a nombre de un socio. Lo que la caja ya había pasado por un socio se
-- conserva: el efectivo que se llevó (al cerrar o con una salida) como dinero de la tienda que tiene, y lo
-- que puso de su bolsillo (una entrada) como aportación al bote que guarda él mismo.
-- (Las restricciones nuevas van antes: la aportación puede tener el mismo socio en de_id y para_id.)
ALTER TABLE "movimientos_socios" DROP CONSTRAINT "movimientos_socios_tipo_ck";--> statement-breakpoint
ALTER TABLE "movimientos_socios" DROP CONSTRAINT "movimientos_socios_partes_ck";--> statement-breakpoint
ALTER TABLE "movimientos_socios" ADD CONSTRAINT "movimientos_socios_tipo_ck" CHECK ("movimientos_socios"."tipo" in ('pago', 'gasto', 'reparto', 'ajuste', 'aportacion'));--> statement-breakpoint
ALTER TABLE "movimientos_socios" ADD CONSTRAINT "movimientos_socios_partes_ck" CHECK (("movimientos_socios"."de_id" is not null or "movimientos_socios"."para_id" is not null) and ("movimientos_socios"."de_id" is distinct from "movimientos_socios"."para_id" or "movimientos_socios"."tipo" = 'aportacion'));--> statement-breakpoint
INSERT INTO "movimientos_socios" ("fecha", "tipo", "para_id", "importe", "motivo", "usuario_id")
SELECT c."hasta", 'ajuste', c."recibe_id", c."contado" - c."fondo_siguiente", 'Efectivo del cierre de caja #' || c."id", c."usuario_id"
FROM "cierres_caja" c WHERE c."recibe_id" IS NOT NULL AND c."contado" > c."fondo_siguiente";--> statement-breakpoint
INSERT INTO "movimientos_socios" ("fecha", "tipo", "de_id", "para_id", "importe", "motivo", "usuario_id")
SELECT m."fecha",
       CASE WHEN m."tipo" = 'entrada' THEN 'aportacion' ELSE 'ajuste' END,
       CASE WHEN m."tipo" = 'entrada' THEN m."socio_id" END,
       m."socio_id",
       m."importe", left(m."motivo", 200), m."usuario_id"
FROM "movimientos_caja" m WHERE m."socio_id" IS NOT NULL;--> statement-breakpoint
DROP TABLE "cierres_caja" CASCADE;--> statement-breakpoint
DROP TABLE "movimientos_caja" CASCADE;
