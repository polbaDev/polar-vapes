import { CatalogoPublico } from "@/components/catalogo-publico";
import { leerAjustes } from "@/lib/ajustes";
import { traductor } from "@/lib/i18n/servidor";
import { basePublica } from "@/lib/origen";
import { catalogoPublico } from "@/lib/reservas";

export default async function Tienda() {
  const [a, t] = await Promise.all([leerAjustes(), traductor()]);
  if (!a.catalogoAbierto) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-semibold">{t("Catálogo cerrado")}</h1>
        <p className="mt-2 text-sm text-zinc-500">{t("Ahora mismo no se pueden hacer reservas. Vuelve a probar más tarde.")}</p>
      </div>
    );
  }
  const [articulos, base] = await Promise.all([catalogoPublico(a.maxUnidades), basePublica()]);
  return (
    <CatalogoPublico
      articulos={articulos}
      base={base}
      maxUnidades={a.maxUnidades}
      minutosConfirmar={a.minutosConfirmar}
      info={a.info}
    />
  );
}
