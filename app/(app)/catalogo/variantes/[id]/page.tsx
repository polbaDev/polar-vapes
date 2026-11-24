import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera, Dato } from "@/components/ui";
import { Foto } from "@/components/foto";
import { EditorImagen } from "@/components/editor-imagen";
import { FormAccion, BotonEnviar } from "@/components/form-accion";
import { CamposVariante } from "@/components/campos-catalogo";
import { borrarVariante, editarVariante } from "@/lib/actions/catalogo";
import { listarSabores, obtenerVariante } from "@/lib/queries";
import { euros } from "@/lib/format";
import { traductor } from "@/lib/i18n/servidor";

export default async function Variante({ params }: { params: Promise<{ id: string }> }) {
  const t = await traductor();
  const id = Number((await params).id);
  const v = Number.isInteger(id) ? await obtenerVariante(id) : null;
  if (!v) notFound();
  const sabores = await listarSabores();
  const coste = Number(v.costeMedio);
  const precio = Number(v.precioVenta);
  const margen = precio > 0 && coste > 0 ? ((precio - coste) / precio) * 100 : null;

  return (
    <>
      <Cabecera
        titulo={`${v.marca} ${v.modelo} · ${v.sabor}`}
        subtitulo={`${v.nicotinaMg} mg`}
        volver={{ href: `/catalogo/productos/${v.productoId}`, texto: `${v.marca} ${v.modelo}` }}
        acciones={
          <>
            <Link href={`/inventario/${v.id}`} className="btn-sec">
              {t("Movimientos")}
            </Link>
            <Link href={`/inventario/ajuste?variante=${v.id}`} className="btn-sec">
              {t("Ajustar stock")}
            </Link>
          </>
        }
      />
      <div className="mb-6 grid gap-4 md:grid-cols-[280px_1fr]">
        <div className="tarjeta overflow-hidden">
          <Foto id={v.imagenPropiaId} color={v.color} alt={`${v.marca} ${v.modelo} ${v.sabor}`} texto={v.sabor} className="aspect-square w-full" />
          <div className="border-t border-zinc-200 p-3">
            <EditorImagen destino="variante" id={v.id} tieneImagen={Boolean(v.imagenPropiaId)} />
          </div>
        </div>
        <div className="space-y-4">
          {v.descripcionSabor && <p className="text-zinc-600">{v.descripcionSabor}</p>}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Dato etiqueta={t("Stock")} valor={v.stock} detalle={t("Aviso en {n}", { n: v.stockMinimo })} />
            <Dato etiqueta={t("Precio")} valor={precio > 0 ? euros(precio) : "—"} />
            <Dato etiqueta={t("Coste medio")} valor={coste > 0 ? euros(coste) : "—"} />
            <Dato
              etiqueta={t("Margen")}
              valor={margen === null ? "—" : `${margen.toFixed(0)} %`}
              detalle={coste > 0 && precio > 0 ? t("{importe} por unidad", { importe: euros(precio - coste) }) : undefined}
            />
          </div>
        </div>
      </div>
      <FormAccion accion={editarVariante} className="tarjeta p-5">
        <input type="hidden" name="id" value={v.id} />
        <CamposVariante sabores={sabores} valores={v} />
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" name="activo" defaultChecked={v.activo} className="h-4 w-4" />
          {t("Activo (si lo desmarcas no aparece al vender ni al comprar)")}
        </label>
        <div className="mt-5">
          <BotonEnviar>{t("Guardar")}</BotonEnviar>
        </div>
      </FormAccion>
      <FormAccion accion={borrarVariante} className="mt-6">
        <input type="hidden" name="id" value={v.id} />
        <input type="hidden" name="producto_id" value={v.productoId} />
        <p className="mb-2 text-sm text-zinc-500">{t("Solo se puede borrar si nunca se ha comprado ni vendido. Si no, desactívalo.")}</p>
        <BotonEnviar className="btn-peligro" textoPendiente={t("Borrando…")}>
          {t("Borrar este sabor")}
        </BotonEnviar>
      </FormAccion>
    </>
  );
}
