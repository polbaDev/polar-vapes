import { Cabecera } from "@/components/ui";
import { FormCompra } from "@/components/form-compra";
import { variantesLigeras } from "@/lib/ligeras";
import { listarProveedores } from "@/lib/queries";
import { hoyISO } from "@/lib/format";
import { exigirSesion } from "@/lib/session";
import { listarSocios } from "@/lib/usuarios";
import { traductor } from "@/lib/i18n/servidor";

export async function generateMetadata() {
  const t = await traductor();
  return { title: t("Nueva compra") };
}

// ?proveedor=3&lineas=12:10,13:5 → compra ya rellena (viene del pedido sugerido)
function leerInicial(sp: { proveedor?: string; lineas?: string }) {
  if (!sp.lineas) return undefined;
  const lineas = sp.lineas
    .split(",")
    .map((par) => par.split(":").map(Number))
    .filter(([id, n]) => Number.isInteger(id) && id > 0 && Number.isInteger(n) && n > 0 && n <= 100000)
    .map(([varianteId, cantidad]) => ({ varianteId, cantidad }));
  return { proveedorId: Number(sp.proveedor) || null, lineas };
}

export default async function NuevaCompra({ searchParams }: { searchParams: Promise<{ proveedor?: string; lineas?: string }> }) {
  const [variantes, proveedores, sp, t, yo, socios] = await Promise.all([
    variantesLigeras(),
    listarProveedores(),
    searchParams,
    traductor(),
    exigirSesion(),
    listarSocios(),
  ]);
  const inicial = leerInicial(sp);
  return (
    <>
      <Cabecera
        titulo={t("Nueva compra")}
        subtitulo={
          inicial
            ? t("Rellenada con tu pedido. Revisa cantidades y costes con la factura antes de guardar.")
            : t("Lo que registres aquí entra en el stock al guardar.")
        }
        volver={{ href: "/compras", texto: t("Compras") }}
      />
      <FormCompra
        variantes={variantes}
        proveedores={proveedores.map((p) => ({ id: p.id, nombre: p.nombre }))}
        hoy={hoyISO()}
        inicial={inicial}
        socios={socios}
        yo={yo.id}
      />
    </>
  );
}
