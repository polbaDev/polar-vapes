import type { Metadata } from "next";
import Link from "next/link";
import { Logotipo, NOMBRE_APP } from "@/components/marca";
import { MenuPreferencias } from "@/components/preferencias";
import { VerificacionEdad } from "@/components/verificacion-edad";
import { traductor } from "@/lib/i18n/servidor";
import { basePublica } from "@/lib/origen";

// Siempre con los datos del momento (stock y reservas)
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await traductor();
  return {
    // El catálogo lleva la marca de la tienda
    title: { absolute: NOMBRE_APP, template: `%s · ${NOMBRE_APP}` },
    description: t("Catálogo y reservas"),
    // Que no salga en buscadores
    robots: { index: false, follow: false },
    manifest: null,
    appleWebApp: null,
  };
}

export default async function LayoutTienda({ children }: { children: React.ReactNode }) {
  const [base, t] = await Promise.all([basePublica(), traductor()]);
  return (
    <div className="min-h-dvh">
      <header className="cab">
        <div className="mx-auto flex min-h-16 max-w-3xl items-center justify-between gap-3 px-4 py-2">
          <Link href={base || "/"} className="marca min-w-0 hover:no-underline" aria-label={NOMBRE_APP}>
            <img src="/icon.svg" alt="" className="h-9 w-9 shrink-0" />
            <Logotipo className="truncate text-[1.35rem] leading-none" />
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Link href={`${base}/r`} className="chip">
              {t("Mi reserva")}
            </Link>
            <MenuPreferencias />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
      <footer className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-4 pb-32 pt-10 text-center">
        <img src="/sello.svg" alt="" className="h-20 w-20 opacity-90" />
        <p className="font-display text-lg font-semibold">PolAr Vapes · Pol &amp; Arnau</p>
        <p className="max-w-md text-xs text-zinc-500">
          {t("Venta solo a mayores de 18 años.")} {t("La nicotina es una sustancia muy adictiva.")}
        </p>
      </footer>
      <VerificacionEdad />
    </div>
  );
}
