import Link from "next/link";
import { BarraMovil, MenuUsuario, NavPrincipal, NavSecundariaMovil, Riel } from "@/components/nav";
import { leerAjustes } from "@/lib/ajustes";
import { contarPendientes } from "@/lib/reservas";

// Todas las pantallas leen la base de datos en cada visita
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [pendientes, ajustes] = await Promise.all([contarPendientes(), leerAjustes()]);
  return (
    <div className="min-h-dvh pb-28 lg:pb-14">
      <header className="cab">
        <div className="mx-auto flex min-h-[var(--alto-cab)] max-w-[1360px] items-center gap-3 px-4 py-2 lg:gap-5 lg:px-7">
          <Link href="/" className="marca shrink-0 hover:no-underline">
            <img src="/icon.svg" alt="" className="h-9 w-9" />
            <span className="hidden xl:block">
              <span className="text-[1.05rem] tracking-[-.02em]">Polar</span>
              <small>{ajustes.nombreTienda}</small>
            </span>
          </Link>
          <NavPrincipal pendientes={pendientes} />
          <NavSecundariaMovil pendientes={pendientes} />
          <MenuUsuario nombreTienda={ajustes.nombreTienda} />
        </div>
      </header>
      <Riel />
      <main id="contenido" className="mx-auto max-w-[1360px] px-4 pb-6 pt-4 sm:px-6 lg:pb-10 lg:pl-[84px] lg:pr-6 lg:pt-6 xl:pl-[104px] xl:pr-10">
        {children}
      </main>
      <BarraMovil />
    </div>
  );
}
