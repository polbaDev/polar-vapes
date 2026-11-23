import { Cabecera, Vacio } from "@/components/ui";
import { FormAccion, BotonEnviar } from "@/components/form-accion";
import { borrarProveedor, crearProveedor, editarProveedor } from "@/lib/actions/catalogo";
import { listarProveedores } from "@/lib/queries";

function Campos({ p }: { p?: { nombre: string; telefono: string | null; email: string | null; notas: string | null } }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <input name="nombre" required defaultValue={p?.nombre} placeholder="Nombre" className="campo" aria-label="Nombre" />
      <input name="telefono" defaultValue={p?.telefono ?? ""} placeholder="Teléfono" className="campo" aria-label="Teléfono" />
      <input name="email" type="email" defaultValue={p?.email ?? ""} placeholder="Email" className="campo" aria-label="Email" />
      <input name="notas" defaultValue={p?.notas ?? ""} placeholder="Notas" className="campo" aria-label="Notas" />
    </div>
  );
}

export default async function Proveedores() {
  const proveedores = await listarProveedores();
  return (
    <>
      <Cabecera titulo="Proveedores" />
      <FormAccion accion={crearProveedor} limpiarAlGuardar className="tarjeta mb-6 p-4">
        <Campos />
        <div className="mt-3">
          <BotonEnviar>Añadir proveedor</BotonEnviar>
        </div>
      </FormAccion>
      {proveedores.length === 0 ? (
        <Vacio>Sin proveedores todavía.</Vacio>
      ) : (
        <ul className="tarjeta divide-y divide-zinc-100">
          {proveedores.map((p) => (
            <li key={p.id} className="px-4 py-3">
              <FormAccion accion={editarProveedor}>
                <input type="hidden" name="id" value={p.id} />
                <Campos p={p} />
                <div className="mt-2 flex items-center gap-3">
                  <BotonEnviar className="btn-sec">Guardar</BotonEnviar>
                  <span className="text-sm text-zinc-500">{p.compras} compras</span>
                </div>
              </FormAccion>
              {p.compras === 0 && (
                <FormAccion accion={borrarProveedor} className="mt-2">
                  <input type="hidden" name="id" value={p.id} />
                  <BotonEnviar className="btn-peligro" textoPendiente="…">
                    Borrar
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
