import type { Metadata } from "next";
import Link from "next/link";
import { VerificacionEdad } from "@/components/verificacion-edad";
import { leerAjustes } from "@/lib/ajustes";
import { basePublica } from "@/lib/origen";

// Siempre con los datos del momento (stock y reservas)
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const a = await leerAjustes();
  return {
    title: a.nombreTienda,
    description: "Catálogo y reservas",
    // Que no salga en buscadores
    robots: { index: false, follow: false },
    manifest: null,
    appleWebApp: null,
  };
}

export default async function LayoutTienda({ children }: { children: React.ReactNode }) {
  const [a, base] = await Promise.all([leerAjustes(), basePublica()]);
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4">
          <Link href={base || "/"} className="truncate font-semibold">
            {a.nombreTienda}
          </Link>
          <Link href={`${base}/r`} className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100">
            Mi reserva
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5 pb-32">{children}</main>
      <VerificacionEdad />
    </div>
  );
}
