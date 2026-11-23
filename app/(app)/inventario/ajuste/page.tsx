import { Cabecera } from "@/components/ui";
import { FormAccion, BotonEnviar } from "@/components/form-accion";
import { ajustarStock } from "@/lib/actions/stock";
import { listarVariantes } from "@/lib/queries";
import { MOTIVOS_AJUSTE } from "@/lib/constants";

export default async function Ajuste({ searchParams }: { searchParams: Promise<{ variante?: string }> }) {
  const { variante } = await searchParams;
  const variantes = await listarVariantes({ incluirInactivos: true });

  return (
    <>
      <Cabecera
        titulo="Ajustar stock"
        subtitulo="Para recuentos, roturas, regalos… Las compras y ventas ya ajustan el stock solas."
        volver={{ href: "/inventario", texto: "Inventario" }}
      />
      <FormAccion accion={ajustarStock} className="tarjeta max-w-2xl space-y-4 p-5">
        <div>
          <label className="etiqueta" htmlFor="variante_id">
            Producto
          </label>
          <select id="variante_id" name="variante_id" defaultValue={variante ?? ""} required className="campo">
            <option value="">— Elige —</option>
            {variantes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.marca} {v.modelo} · {v.sabor} · {v.nicotinaMg} mg (stock {v.stock})
              </option>
            ))}
          </select>
        </div>
        <fieldset>
          <legend className="etiqueta">¿Qué quieres hacer?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-start gap-2 rounded-lg border border-zinc-200 p-3 text-sm has-[:checked]:border-marca-500 has-[:checked]:bg-marca-50">
              <input type="radio" name="modo" value="contado" defaultChecked className="mt-0.5" />
              <span>
                <span className="block font-medium">He contado las unidades</span>
                <span className="text-zinc-500">Escribe cuántas hay de verdad</span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-zinc-200 p-3 text-sm has-[:checked]:border-marca-500 has-[:checked]:bg-marca-50">
              <input type="radio" name="modo" value="diferencia" className="mt-0.5" />
              <span>
                <span className="block font-medium">Sumar o restar</span>
                <span className="text-zinc-500">Ej. −1 por uno roto, +2 encontrados</span>
              </span>
            </label>
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="etiqueta" htmlFor="valor">
              Unidades
            </label>
            <input id="valor" name="valor" type="number" step={1} required inputMode="numeric" className="campo" />
          </div>
          <div>
            <label className="etiqueta" htmlFor="motivo">
              Motivo
            </label>
            <select id="motivo" name="motivo" className="campo" defaultValue="recuento">
              {MOTIVOS_AJUSTE.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="etiqueta" htmlFor="nota">
            Nota <span className="font-normal text-zinc-400">(opcional)</span>
          </label>
          <input id="nota" name="nota" className="campo" />
        </div>
        <BotonEnviar>Guardar ajuste</BotonEnviar>
      </FormAccion>
    </>
  );
}
