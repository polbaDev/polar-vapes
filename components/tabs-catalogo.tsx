"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/components/preferencias";
import { tx } from "@/lib/i18n";

const TABS = [
  { href: "/catalogo", texto: tx("Productos") },
  { href: "/catalogo/sabores", texto: tx("Sabores") },
  { href: "/catalogo/marcas", texto: tx("Marcas") },
  { href: "/catalogo/proveedores", texto: tx("Proveedores") },
];

export function TabsCatalogo() {
  const path = usePathname();
  const t = useT();
  const actual = TABS.slice(1).find((x) => path.startsWith(x.href))?.href ?? "/catalogo";
  return (
    <nav className="mb-6 overflow-x-auto [scrollbar-width:none]" aria-label={t("Catálogo")}>
      <div className="segmento inline-flex">
        {TABS.map((x) => (
          <Link key={x.href} href={x.href} aria-current={actual === x.href ? "page" : undefined}>
            {t(x.texto)}
          </Link>
        ))}
      </div>
    </nav>
  );
}
