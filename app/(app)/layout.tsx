import Link from "next/link";
import { Contador, NavEscritorio, NavMovil } from "@/components/nav";
import { salir } from "@/lib/actions/auth";
import { contarPendientes } from "@/lib/reservas";

// Todas las pantallas leen la base de datos en cada visita
export const dynamic = "force-dynamic";

const ENLACE_MOVIL = "rounded-lg px-2 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 md:hidden";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const pendientes = await contarPendientes();
  return (
    <div className="min-h-dvh pb-24 md:pb-10">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
            <img src="/icon.svg" alt="" className="h-7 w-7" />
            <span className="hidden lg:inline">Gestión Vapers</span>
          </Link>
          <NavEscritorio pendientes={pendientes} />
          <div className="flex items-center">
            <Link href="/reservas" className={`${ENLACE_MOVIL} inline-flex items-center`}>
              Reservas
              <Contador n={pendientes} />
            </Link>
            <Link href="/caja" className={ENLACE_MOVIL}>
              Caja
            </Link>
            <Link href="/catalogo" className={ENLACE_MOVIL}>
              Catálogo
            </Link>
            <form action={salir}>
              <button className="rounded-lg px-2 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800">Salir</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <NavMovil />
    </div>
  );
}
