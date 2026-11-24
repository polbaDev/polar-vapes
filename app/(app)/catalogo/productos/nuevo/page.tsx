import { Cabecera } from "@/components/ui";
import { FormAccion, BotonEnviar } from "@/components/form-accion";
import { CamposProducto } from "@/components/campos-catalogo";
import { crearProducto } from "@/lib/actions/catalogo";
import { listarMarcas } from "@/lib/queries";
import { traductor } from "@/lib/i18n/servidor";

export default async function NuevoProducto() {
  const t = await traductor();
  const marcas = await listarMarcas();
  return (
    <>
      <Cabecera
        titulo={t("Nuevo producto")}
        subtitulo={t("Después podrás añadirle los sabores.")}
        volver={{ href: "/catalogo", texto: t("Productos") }}
      />
      <FormAccion accion={crearProducto} className="tarjeta max-w-3xl p-5">
        <CamposProducto marcas={marcas} />
        <div className="mt-5">
          <BotonEnviar>{t("Crear y añadir sabores")}</BotonEnviar>
        </div>
      </FormAccion>
    </>
  );
}
