"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ENLACES = [
  { href: "/", texto: "Inicio", icono: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" },
  { href: "/ventas", texto: "Ventas", icono: "M4 4h16v16H4zM8 9h8M8 13h8M8 17h5" },
  { href: "/ventas/nueva", texto: "Vender", icono: "M12 5v14M5 12h14", destacado: true },
  { href: "/compras", texto: "Compras", icono: "M3 4h2l2.5 11h11L21 7H7M10 20a1 1 0 1 0 0-.01M18 20a1 1 0 1 0 0-.01" },
  { href: "/inventario", texto: "Stock", icono: "M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10" },
];

function activo(path: string, href: string) {
  if (href === "/") return path === "/";
  if (href === "/ventas") return path === "/ventas" || /^\/ventas\/\d+/.test(path);
  return path.startsWith(href);
}

function Icono({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function NavEscritorio() {
  const path = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {[...ENLACES, { href: "/caja", texto: "Caja", icono: "" }, { href: "/catalogo", texto: "Catálogo", icono: "" }].map((e) =>
        "destacado" in e && e.destacado ? (
          <Link key={e.href} href={e.href} className="btn ml-1 mr-1 py-1.5">
            + Vender
          </Link>
        ) : (
          <Link
            key={e.href}
            href={e.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              activo(path, e.href) ? "bg-marca-50 text-marca-700" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            {e.texto}
          </Link>
        ),
      )}
    </nav>
  );
}

export function NavMovil() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {ENLACES.map((e) =>
          e.destacado ? (
            <Link key={e.href} href={e.href} className="flex flex-col items-center justify-center py-1.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-marca-600 text-white shadow-sm">
                <Icono d={e.icono} />
              </span>
            </Link>
          ) : (
            <Link
              key={e.href}
              href={e.href}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                activo(path, e.href) ? "text-marca-700" : "text-zinc-500"
              }`}
            >
              <Icono d={e.icono} />
              {e.texto}
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}
