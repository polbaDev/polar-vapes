"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Icono, type NombreIcono } from "@/components/iconos";
import { BotonTema, FilasPreferencias, useT } from "@/components/preferencias";
import { salir } from "@/lib/actions/auth";
import { tx } from "@/lib/i18n";

type Enlace = { href: string; texto: string; icono: NombreIcono };

// Secciones (textos en castellano: se traducen al pintar)
const SECCIONES: Enlace[] = [
  { href: "/", texto: tx("Inicio"), icono: "inicio" },
  { href: "/ventas", texto: tx("Ventas"), icono: "ticket" },
  { href: "/compras", texto: tx("Compras"), icono: "camion" },
  { href: "/inventario", texto: tx("Stock"), icono: "caja" },
  { href: "/reservas", texto: tx("Reservas"), icono: "pedido" },
  { href: "/caja", texto: tx("Caja"), icono: "carrito" },
  { href: "/catalogo", texto: tx("Catálogo"), icono: "tienda" },
];

// Accesos rápidos del riel (escritorio)
const RAPIDOS: Enlace[] = [
  { href: "/ventas/nueva", texto: tx("Vender"), icono: "mas" },
  { href: "/compras/nueva", texto: tx("Registrar compra"), icono: "camion" },
  { href: "/compras/pedido", texto: tx("Pedido sugerido"), icono: "pedido" },
  { href: "/inventario/ajuste", texto: tx("Ajustar stock"), icono: "recuento" },
  { href: "/catalogo/productos/nuevo", texto: tx("Nuevo producto"), icono: "productoNuevo" },
];

function activo(path: string, href: string) {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

// Número de reservas por confirmar al lado del enlace
export function Contador({ n }: { n: number }) {
  if (n <= 0) return null;
  return <span className="contador">{n}</span>;
}

// Navegación principal en cápsula. La píldora del enlace activo se estira hacia el nuevo:
// el borde de delante va rápido y el de detrás con retraso (ver .pildora en globals.css).
export function NavPrincipal({ pendientes = 0 }: { pendientes?: number }) {
  const path = usePathname();
  const t = useT();
  const navRef = useRef<HTMLElement>(null);
  const pildoraRef = useRef<HTMLSpanElement>(null);
  const anterior = useRef<{ izq: number; der: number } | null>(null);
  const [conPildora, setConPildora] = useState(false);

  const colocar = useCallback((animar: boolean) => {
    const nav = navRef.current;
    const pildora = pildoraRef.current;
    if (!nav || !pildora) return;
    const actual = nav.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!actual) {
      anterior.current = null;
      setConPildora(false);
      return;
    }
    const b = { izq: actual.offsetLeft, der: nav.clientWidth - actual.offsetLeft - actual.offsetWidth };
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (animar && anterior.current && !quieto) pildora.dataset.dir = b.izq >= anterior.current.izq ? "der" : "izq";
    else delete pildora.dataset.dir;
    pildora.style.setProperty("--pill-izq", `${b.izq}px`);
    pildora.style.setProperty("--pill-der", `${b.der}px`);
    anterior.current = b;
    setConPildora(true);
  }, []);

  useLayoutEffect(() => {
    colocar(true);
  }, [path, pendientes, t, colocar]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    // Medir de nuevo cuando cargue la fuente o cambie el tamaño (sin animar)
    document.fonts?.ready.then(() => colocar(false));
    const ro = new ResizeObserver(() => colocar(false));
    ro.observe(nav);
    return () => ro.disconnect();
  }, [colocar]);

  return (
    <nav ref={navRef} className={`cab__nav mx-auto hidden lg:flex ${conPildora ? "con-pildora" : ""}`} aria-label={t("Navegación principal")}>
      {SECCIONES.map((e) => (
        <Link key={e.href} href={e.href} aria-current={activo(path, e.href) ? "page" : undefined}>
          {t(e.texto)}
          {e.href === "/reservas" && <Contador n={pendientes} />}
        </Link>
      ))}
      <span ref={pildoraRef} className="pildora" aria-hidden />
    </nav>
  );
}

// En móvil, las secciones que no caben en la barra de abajo van arriba, en una cápsula pequeña
export function NavSecundariaMovil({ pendientes = 0 }: { pendientes?: number }) {
  const path = usePathname();
  const t = useT();
  return (
    <nav className="segmento ml-auto vidrio lg:hidden" aria-label={t("Más secciones")}>
      {SECCIONES.slice(4).map((e) => (
        <Link key={e.href} href={e.href} aria-current={activo(path, e.href) ? "page" : undefined} className="inline-flex items-center !px-2.5 sm:!px-3.5">
          {t(e.texto)}
          {e.href === "/reservas" && <Contador n={pendientes} />}
        </Link>
      ))}
    </nav>
  );
}

// Riel flotante de accesos rápidos (escritorio), con el cambio de tema al final
export function Riel() {
  const path = usePathname();
  const t = useT();
  return (
    <nav className="riel vidrio hidden lg:flex" aria-label={t("Accesos rápidos")}>
      {RAPIDOS.map((e, i) => (
        <Link
          key={e.href}
          href={e.href}
          title={t(e.texto)}
          aria-label={t(e.texto)}
          aria-current={path === e.href ? "page" : undefined}
          className={`boton-ico ${i === 0 ? "boton-ico--primario" : ""}`}
        >
          <Icono nombre={e.icono} />
        </Link>
      ))}
      <span className="riel__sep" />
      <Link href="/ajustes" title={t("Ajustes del catálogo")} aria-label={t("Ajustes del catálogo")} aria-current={path === "/ajustes" ? "page" : undefined} className="boton-ico">
        <Icono nombre="ajustes" />
      </Link>
      <BotonTema />
    </nav>
  );
}

// Barra inferior del móvil: cápsula de vidrio con «Vender» en el centro
export function BarraMovil() {
  const path = usePathname();
  const t = useT();
  const enlaces = [SECCIONES[0], SECCIONES[1], RAPIDOS[0], SECCIONES[2], SECCIONES[3]];
  return (
    <nav className="barra-movil vidrio lg:hidden" aria-label={t("Navegación principal")}>
      {enlaces.map((e) =>
        e.href === "/ventas/nueva" ? (
          <Link key={e.href} href={e.href} aria-label={t(e.texto)} className="!py-0">
            <span className="boton-ico boton-ico--primario h-12 w-12">
              <Icono nombre="mas" className="h-6 w-6" />
            </span>
          </Link>
        ) : (
          <Link key={e.href} href={e.href} aria-current={activo(path, e.href) && path !== "/ventas/nueva" ? "page" : undefined}>
            <Icono nombre={e.icono} className="h-5 w-5" />
            {t(e.texto)}
          </Link>
        ),
      )}
    </nav>
  );
}

function iniciales(nombre: string) {
  return (
    nombre
      .split(/\s+/)
      .filter((p) => /^\p{L}/u.test(p))
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("") || "GV"
  );
}

// Menú de la tienda: tema, idioma, ajustes y salir
export function MenuUsuario({ nombreTienda }: { nombreTienda: string }) {
  const t = useT();
  const cerrar = () => document.getElementById("menu-usuario")?.hidePopover();
  return (
    <>
      <button
        type="button"
        popoverTarget="menu-usuario"
        className="boton-ico boton-ico--cab"
        title={t("Menú")}
        aria-label={t("Menú")}
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-acento text-[.72rem] font-bold text-[#2a0c14]">{iniciales(nombreTienda)}</span>
      </button>
      <div id="menu-usuario" popover="auto" className="pop pop--cab">
        <div className="pop__cab">
          <b>{nombreTienda}</b>
          <span>{t("Gestión de la tienda")}</span>
        </div>
        <FilasPreferencias />
        <div className="pop__sep" />
        <div className="pop__lista">
          <Link href="/ajustes" onClick={cerrar}>
            <Icono nombre="ajustes" className="h-[15px] w-[15px]" />
            {t("Ajustes del catálogo")}
          </Link>
          <a href="/tienda" target="_blank" rel="noopener" onClick={cerrar}>
            <Icono nombre="tienda" className="h-[15px] w-[15px]" />
            {t("Ver el catálogo público")}
          </a>
        </div>
        <div className="pop__sep" />
        <form action={salir} className="pop__lista">
          <button type="submit">
            <Icono nombre="salir" className="h-[15px] w-[15px]" />
            {t("Salir")}
          </button>
        </form>
      </div>
    </>
  );
}
