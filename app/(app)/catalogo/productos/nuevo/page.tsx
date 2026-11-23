import { Cabecera } from "@/components/ui";
import { FormAccion, BotonEnviar } from "@/components/form-accion";
import { CamposProducto } from "@/components/campos-catalogo";
import { crearProducto } from "@/lib/actions/catalogo";
import { listarMarcas } from "@/lib/queries";

export default async function NuevoProducto() {
  const marcas = await listarMarcas();
  return (
    <>
      <Cabecera titulo="Nuevo producto" subtitulo="Después podrás añadirle los sabores." volver={{ href: "/catalogo", texto: "Productos" }} />
      <FormAccion accion={crearProducto} className="tarjeta max-w-3xl p-5">
        <CamposProducto marcas={marcas} />
        <div className="mt-5">
          <BotonEnviar>Crear y añadir sabores</BotonEnviar>
        </div>
      </FormAccion>
    </>
  );
}
