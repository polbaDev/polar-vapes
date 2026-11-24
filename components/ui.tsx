import Link from "next/link";
import type { ReactNode } from "react";
import { Icono } from "@/components/iconos";
import { euros } from "@/lib/format";
import { traductor } from "@/lib/i18n/servidor";

// Componentes de servidor: los textos llegan ya traducidos desde cada página (con t).

export function Cabecera({
  titulo,
  subtitulo,
  acciones,
  volver,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  acciones?: ReactNode;
  volver?: { href: string; texto: string };
}) {
  return (
    <div className="mb-6">
      {volver && (
        <Link
          href={volver.href}
          className="mb-3 inline-flex items-center gap-1.5 rounded-full py-1 pr-2 text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
        >
          <Icono nombre="atras" className="h-4 w-4" />
          {volver.texto}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="titulo-pagina">{titulo}</h1>
          {subtitulo && <p className="mt-2 text-sm text-zinc-500">{subtitulo}</p>}
        </div>
        {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
      </div>
    </div>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[var(--radio-tarjeta)] border border-dashed border-zinc-300 bg-superficie/50 px-4 py-10 text-center text-sm text-zinc-500">
      {children}
    </div>
  );
}

const TONOS = {
  gris: "bg-zinc-100 text-zinc-700",
  verde: "bg-emerald-50 text-emerald-800",
  rojo: "bg-red-50 text-red-700",
  ambar: "bg-amber-50 text-amber-800",
  marca: "bg-marca-50 text-marca-700",
} as const;

// Insignia en píldora con un punto del mismo color
export function Insignia({ tono = "gris", children }: { tono?: keyof typeof TONOS; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold before:size-1.5 before:shrink-0 before:rounded-full before:bg-current before:opacity-85 before:content-[''] ${TONOS[tono]}`}
    >
      {children}
    </span>
  );
}

// Cifra destacada (KPI)
export function Dato({ etiqueta, valor, detalle }: { etiqueta: string; valor: ReactNode; detalle?: ReactNode }) {
  return (
    <div className="tarjeta min-w-0 px-4 py-3.5 sm:px-5 sm:py-4">
      <div className="text-[.82rem] font-medium text-zinc-500">{etiqueta}</div>
      <div className="mt-1.5 text-[1.3rem] font-[550] leading-tight tracking-[-.025em] tabular-nums sm:text-[1.6rem]">{valor}</div>
      {detalle && <div className="mt-1 text-xs text-zinc-500">{detalle}</div>}
    </div>
  );
}

// Resultado de un cierre de caja: contado - esperado
export async function InsigniaDescuadre({ valor }: { valor: number | string }) {
  const t = await traductor();
  const n = Number(valor);
  if (n === 0) return <Insignia tono="verde">{t("Cuadra")}</Insignia>;
  if (n < 0) return <Insignia tono="rojo">{t("Faltan {importe}", { importe: euros(-n) })}</Insignia>;
  return <Insignia tono="ambar">{t("Sobran {importe}", { importe: euros(n) })}</Insignia>;
}

export function InsigniaStock({ stock, minimo }: { stock: number; minimo: number }) {
  if (stock <= 0) return <Insignia tono="rojo">{stock}</Insignia>;
  if (stock <= minimo) return <Insignia tono="ambar">{stock}</Insignia>;
  return <Insignia tono="verde">{stock}</Insignia>;
}
