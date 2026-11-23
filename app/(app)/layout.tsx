import Link from "next/link";
import { NavEscritorio, NavMovil } from "@/components/nav";
import { salir } from "@/lib/actions/auth";

// Todas las pantallas leen la base de datos en cada visita
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh pb-24 md:pb-10">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <img src="/icon.svg" alt="" className="h-7 w-7" />
            <span className="hidden sm:inline">Gestión Vapers</span>
          </Link>
          <NavEscritorio />
          <div className="flex items-center gap-1">
            <Link href="/caja" className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 md:hidden">
              Caja
            </Link>
            <Link href="/catalogo" className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 md:hidden">
              Catálogo
            </Link>
            <form action={salir}>
              <button className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800">Salir</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <NavMovil />
    </div>
  );
}
