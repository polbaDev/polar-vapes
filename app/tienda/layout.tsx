import type { Metadata } from "next";
import Link from "next/link";
import { MenuPreferencias } from "@/components/preferencias";
import { VerificacionEdad } from "@/components/verificacion-edad";
import { leerAjustes } from "@/lib/ajustes";
import { traductor } from "@/lib/i18n/servidor";
import { basePublica } from "@/lib/origen";

// Siempre con los datos del momento (stock y reservas)
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [a, t] = await Promise.all([leerAjustes(), traductor()]);
  return {
    // Título propio: el catálogo no lleva el nombre de la app de gestión
    title: { absolute: a.nombreTienda, template: `%s · ${a.nombreTienda}` },
    description: t("Catálogo y reservas"),
    // Que no salga en buscadores
    robots: { index: false, follow: false },
    manifest: null,
    appleWebApp: null,
  };
}

export default async function LayoutTienda({ children }: { children: React.ReactNode }) {
  const [a, base, t] = await Promise.all([leerAjustes(), basePublica(), traductor()]);
  return (
    <div className="min-h-dvh">
      <header className="cab">
        <div className="mx-auto flex min-h-16 max-w-3xl items-center justify-between gap-3 px-4 py-2">
          <Link href={base || "/"} className="marca truncate text-lg hover:no-underline">
            {a.nombreTienda}
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Link href={`${base}/r`} className="chip">
              {t("Mi reserva")}
            </Link>
            <MenuPreferencias />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5 pb-32">{children}</main>
      <VerificacionEdad />
    </div>
  );
}
