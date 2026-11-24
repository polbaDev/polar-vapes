"use client";

import { createContext, useCallback, useContext, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { crearT, tEs, type T } from "@/lib/i18n";
import { COOKIE_IDIOMA, COOKIE_TEMA, IDIOMAS, NOMBRE_IDIOMA, UN_ANO, type Idioma, type Tema } from "@/lib/preferencias";
import { Icono } from "@/components/iconos";

type Contexto = {
  idioma: Idioma;
  t: T;
  tema: Tema;
  ponerTema: (tema: Tema) => void;
  ponerIdioma: (idioma: Idioma) => void;
  cambiandoIdioma: boolean;
};

const Ctx = createContext<Contexto>({
  idioma: "es",
  t: tEs,
  tema: "sistema",
  ponerTema: () => {},
  ponerIdioma: () => {},
  cambiandoIdioma: false,
});

function guardarCookie(nombre: string, valor: string | null) {
  document.cookie =
    valor === null ? `${nombre}=; path=/; max-age=0; samesite=lax` : `${nombre}=${valor}; path=/; max-age=${UN_ANO}; samesite=lax`;
}

// Cambio con fundido (View Transitions) si el navegador lo admite y no se ha pedido reducir el movimiento.
// Sin soporte se aplica directamente: nunca `startViewTransition?.(fn)`, que no cambiaría nada.
function conTransicion(cambio: () => void) {
  const doc = document as Document & { startViewTransition?: (fn: () => void) => { ready: Promise<void> } };
  if (!doc.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    cambio();
    return;
  }
  doc.startViewTransition(cambio).ready.catch(() => {});
}

// El servidor lee las cookies y pinta <html> ya con el tema y el idioma; aquí solo se cambian.
export function Preferencias({ idioma, tema: temaInicial, children }: { idioma: Idioma; tema: Tema; children: ReactNode }) {
  const router = useRouter();
  const [tema, setTema] = useState(temaInicial);
  const [cambiandoIdioma, startTransition] = useTransition();

  const ponerTema = useCallback((nuevo: Tema) => {
    conTransicion(() => {
      const html = document.documentElement;
      if (nuevo === "sistema") delete html.dataset.tema;
      else html.dataset.tema = nuevo;
      setTema(nuevo);
    });
    guardarCookie(COOKIE_TEMA, nuevo === "sistema" ? null : nuevo);
  }, []);

  const ponerIdioma = useCallback(
    (nuevo: Idioma) => {
      guardarCookie(COOKIE_IDIOMA, nuevo);
      // Vuelve a pedir la página al servidor: todos los textos llegan ya en el idioma nuevo
      startTransition(() => router.refresh());
    },
    [router],
  );

  const valor = useMemo(
    () => ({ idioma, t: crearT(idioma), tema, ponerTema, ponerIdioma, cambiandoIdioma }),
    [idioma, tema, ponerTema, ponerIdioma, cambiandoIdioma],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

// En componentes de cliente: const t = useT();
export function useT() {
  return useContext(Ctx).t;
}

export function usePreferencias() {
  return useContext(Ctx);
}

function temaEfectivo(tema: Tema) {
  if (tema !== "sistema") return tema;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro";
}

// Claro / Oscuro / Sistema
export function SelectorTema() {
  const { t, tema, ponerTema } = usePreferencias();
  const opciones: { valor: Tema; texto: string }[] = [
    { valor: "claro", texto: t("Claro") },
    { valor: "oscuro", texto: t("Oscuro") },
    { valor: "sistema", texto: t("Sistema") },
  ];
  return (
    <span className="opciones" role="group" aria-label={t("Tema")}>
      {opciones.map((o) => (
        <button key={o.valor} type="button" aria-pressed={tema === o.valor} onClick={() => ponerTema(o.valor)}>
          {o.texto}
        </button>
      ))}
    </span>
  );
}

// Castellano / Català (cada idioma escrito en sí mismo)
export function SelectorIdioma() {
  const { t, idioma, ponerIdioma, cambiandoIdioma } = usePreferencias();
  return (
    <span className="opciones" role="group" aria-label={t("Idioma")} aria-busy={cambiandoIdioma}>
      {IDIOMAS.map((i) => (
        <button key={i} type="button" lang={i} aria-pressed={idioma === i} onClick={() => idioma !== i && ponerIdioma(i)}>
          {NOMBRE_IDIOMA[i]}
        </button>
      ))}
    </span>
  );
}

// Interruptor rápido claro ↔ oscuro (sol / luna)
export function BotonTema({ className = "boton-ico" }: { className?: string }) {
  const { t, tema, ponerTema } = usePreferencias();
  // Luna en claro y sol en oscuro. Lo decide el CSS (.solo-claro / .solo-oscuro), así el icono es correcto
  // desde el primer pintado aunque el tema sea «sistema».
  const etiqueta = t("Cambiar de tema");
  return (
    <button
      type="button"
      className={`${className} boton-ico--tema`}
      onClick={() => ponerTema(temaEfectivo(tema) === "oscuro" ? "claro" : "oscuro")}
      title={etiqueta}
      aria-label={etiqueta}
    >
      <span className="solo-claro">
        <Icono nombre="luna" />
      </span>
      <span className="solo-oscuro">
        <Icono nombre="sol" />
      </span>
    </button>
  );
}

// Filas de tema e idioma para un menú desplegable
export function FilasPreferencias() {
  const t = useT();
  return (
    <>
      <div className="pop__fila">
        <span className="flex-1">{t("Tema")}</span>
        <SelectorTema />
      </div>
      <div className="pop__fila">
        <span className="flex-1">{t("Idioma")}</span>
        <SelectorIdioma />
      </div>
    </>
  );
}

// Botón con menú de tema e idioma (catálogo público y pantalla de entrada)
export function MenuPreferencias() {
  const t = useT();
  return (
    <>
      <button
        type="button"
        popoverTarget="menu-preferencias"
        className="boton-ico boton-ico--cab"
        title={t("Tema e idioma")}
        aria-label={t("Tema e idioma")}
      >
        <Icono nombre="mundo" />
      </button>
      <div id="menu-preferencias" popover="auto" className="pop pop--cab">
        <FilasPreferencias />
      </div>
    </>
  );
}
