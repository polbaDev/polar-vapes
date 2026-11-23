import { Cabecera } from "@/components/ui";
import { FormCompra } from "@/components/form-compra";
import { variantesLigeras } from "@/lib/ligeras";
import { listarProveedores } from "@/lib/queries";
import { hoyISO } from "@/lib/format";

export const metadata = { title: "Nueva compra · Gestión Vapers" };

export default async function NuevaCompra() {
  const [variantes, proveedores] = await Promise.all([variantesLigeras(), listarProveedores()]);
  return (
    <>
      <Cabecera titulo="Nueva compra" subtitulo="Lo que registres aquí entra en el stock al guardar." volver={{ href: "/compras", texto: "Compras" }} />
      <FormCompra variantes={variantes} proveedores={proveedores.map((p) => ({ id: p.id, nombre: p.nombre }))} hoy={hoyISO()} />
    </>
  );
}
