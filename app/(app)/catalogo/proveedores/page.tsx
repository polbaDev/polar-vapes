import { Cabecera, Vacio } from "@/components/ui";
import { FormAccion, BotonEnviar } from "@/components/form-accion";
import { borrarProveedor, crearProveedor, editarProveedor } from "@/lib/actions/catalogo";
import { listarProveedores } from "@/lib/queries";
import { traductor } from "@/lib/i18n/servidor";

async function Campos({ p }: { p?: { nombre: string; telefono: string | null; email: string | null; notas: string | null } }) {
  const t = await traductor();
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <input name="nombre" required defaultValue={p?.nombre} placeholder={t("Nombre")} className="campo" aria-label={t("Nombre")} />
      <input name="telefono" type="tel" inputMode="tel" defaultValue={p?.telefono ?? ""} placeholder={t("Teléfono")} className="campo" aria-label={t("Teléfono")} />
      <input name="email" type="email" defaultValue={p?.email ?? ""} placeholder={t("Email")} className="campo" aria-label={t("Email")} />
      <input name="notas" defaultValue={p?.notas ?? ""} placeholder={t("Notas")} className="campo" aria-label={t("Notas")} />
    </div>
  );
}

export default async function Proveedores() {
  const t = await traductor();
  const proveedores = await listarProveedores();
  return (
    <>
      <Cabecera titulo={t("Proveedores")} />
      <FormAccion accion={crearProveedor} limpiarAlGuardar className="tarjeta mb-6 p-4">
        <Campos />
        <div className="mt-3">
          <BotonEnviar>{t("Añadir proveedor")}</BotonEnviar>
        </div>
      </FormAccion>
      {proveedores.length === 0 ? (
        <Vacio>{t("Sin proveedores todavía.")}</Vacio>
      ) : (
        <ul className="tarjeta divide-y divide-zinc-100">
          {proveedores.map((p) => (
            <li key={p.id} className="px-4 py-3">
              <FormAccion accion={editarProveedor}>
                <input type="hidden" name="id" value={p.id} />
                <Campos p={p} />
                <div className="mt-2 flex items-center gap-3">
                  <BotonEnviar className="btn-sec">{t("Guardar")}</BotonEnviar>
                  <span className="text-sm text-zinc-500">
                    {p.compras === 1 ? t("1 compra") : t("{n} compras", { n: p.compras })}
                  </span>
                </div>
              </FormAccion>
              {p.compras === 0 && (
                <FormAccion accion={borrarProveedor} className="mt-2">
                  <input type="hidden" name="id" value={p.id} />
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
