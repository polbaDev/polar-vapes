import { Cabecera, Vacio } from "@/components/ui";
import { FormAccion, BotonEnviar } from "@/components/form-accion";
import { borrarMarca, crearMarca, editarMarca } from "@/lib/actions/catalogo";
import { listarMarcas } from "@/lib/queries";
import { traductor } from "@/lib/i18n/servidor";

export default async function Marcas() {
  const t = await traductor();
  const marcas = await listarMarcas();
  return (
    <>
      <Cabecera titulo={t("Marcas")} />
      <FormAccion accion={crearMarca} limpiarAlGuardar className="tarjeta mb-6 p-4">
        <div className="flex gap-2">
          <input name="nombre" required placeholder={t("Nueva marca")} className="campo" />
          <BotonEnviar>{t("Añadir")}</BotonEnviar>
        </div>
      </FormAccion>
      {marcas.length === 0 ? (
        <Vacio>{t("Sin marcas. También se crean solas al dar de alta un producto.")}</Vacio>
      ) : (
        <ul className="tarjeta divide-y divide-zinc-100">
          {marcas.map((m) => (
            <li key={m.id} className="flex flex-wrap items-start gap-2 px-4 py-3">
              <FormAccion accion={editarMarca} className="flex min-w-0 flex-1 gap-2">
                <input type="hidden" name="id" value={m.id} />
                <input name="nombre" defaultValue={m.nombre} required className="campo" aria-label={t("Nombre")} />
                <BotonEnviar className="btn-sec">{t("Guardar")}</BotonEnviar>
              </FormAccion>
              <span className="pt-2 text-sm text-zinc-500">
                {m.productos === 1 ? t("1 producto") : t("{n} productos", { n: m.productos })}
              </span>
              {m.productos === 0 && (
                <FormAccion accion={borrarMarca}>
                  <input type="hidden" name="id" value={m.id} />
                  <BotonEnviar className="btn-peligro" textoPendiente="…">
                    {t("Borrar")}
                  </BotonEnviar>
                </FormAccion>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
