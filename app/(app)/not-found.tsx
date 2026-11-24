import Link from "next/link";
import { traductor } from "@/lib/i18n/servidor";

export default async function NoEncontrado() {
  const t = await traductor();
  return (
    <div className="py-16 text-center">
      <h1 className="titulo-pagina">{t("No encontrado")}</h1>
      <p className="mt-3 text-sm text-zinc-500">{t("Esa página no existe o se ha borrado.")}</p>
      <Link href="/" className="btn mt-6">
        {t("Volver al inicio")}
      </Link>
    </div>
  );
}
