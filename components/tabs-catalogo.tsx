"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/catalogo", texto: "Productos" },
  { href: "/catalogo/sabores", texto: "Sabores" },
  { href: "/catalogo/marcas", texto: "Marcas" },
  { href: "/catalogo/proveedores", texto: "Proveedores" },
];

export function TabsCatalogo() {
  const path = usePathname();
  const actual =
    TABS.slice(1).find((t) => path.startsWith(t.href))?.href ?? "/catalogo";
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-zinc-200">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
            actual === t.href ? "border-marca-600 text-marca-700" : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          {t.texto}
        </Link>
      ))}
    </div>
  );
}
