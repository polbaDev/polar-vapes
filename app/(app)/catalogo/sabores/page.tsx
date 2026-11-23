import { Cabecera, Vacio } from "@/components/ui";
import { FormAccion, BotonEnviar } from "@/components/form-accion";
import { borrarSabor, crearSabor, editarSabor } from "@/lib/actions/catalogo";
import { listarSabores } from "@/lib/queries";
import { CATEGORIAS_SABOR } from "@/lib/constants";

function SelectCategoria({ valor }: { valor?: string }) {
  return (
    <select name="categoria" defaultValue={valor ?? "fruta"} className="campo sm:w-44" aria-label="Categoría">
      {CATEGORIAS_SABOR.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
    </select>
  );
}

export default async function Sabores() {
  const sabores = await listarSabores();
  const porCategoria = CATEGORIAS_SABOR.map((c) => ({
    ...c,
    n: sabores.filter((s) => s.categoria === c.value).length,
  })).filter((c) => c.n > 0);

  return (
    <>
      <Cabecera
        titulo="Sabores"
        subtitulo="La categoría te sirve para los informes y por si cambia la normativa sobre sabores (por ejemplo, separar tabaco del resto)."
      />
      <FormAccion accion={crearSabor} limpiarAlGuardar className="tarjeta mb-6 p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input name="nombre" required placeholder="Nuevo sabor" className="campo" />
          <input name="descripcion" placeholder="Descripción (opcional)" className="campo" />
          <SelectCategoria />
          <BotonEnviar>Añadir</BotonEnviar>
        </div>
      </FormAccion>
      {porCategoria.length > 0 && (
        <p className="mb-3 text-sm text-zinc-500">{porCategoria.map((c) => `${c.label}: ${c.n}`).join(" · ")}</p>
      )}
      {sabores.length === 0 ? (
        <Vacio>Sin sabores. También se crean al añadirlos a un producto.</Vacio>
      ) : (
        <ul className="tarjeta divide-y divide-zinc-100">
          {sabores.map((s) => (
            <li key={s.id} className="flex flex-wrap items-start gap-2 px-4 py-3">
              <FormAccion accion={editarSabor} className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
                <input type="hidden" name="id" value={s.id} />
                <input name="nombre" defaultValue={s.nombre} required className="campo" aria-label="Nombre" />
                <input name="descripcion" defaultValue={s.descripcion ?? ""} placeholder="Descripción" className="campo" aria-label="Descripción" />
                <SelectCategoria valor={s.categoria} />
                <BotonEnviar className="btn-sec">Guardar</BotonEnviar>
              </FormAccion>
              <span className="pt-2 text-sm text-zinc-500">{s.variantes} productos</span>
              {s.variantes === 0 && (
                <FormAccion accion={borrarSabor}>
                  <input type="hidden" name="id" value={s.id} />
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
