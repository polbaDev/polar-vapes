import Link from "next/link";
import type { ReactNode } from "react";

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
    <div className="mb-5">
      {volver && (
        <Link href={volver.href} className="mb-2 inline-block text-sm text-zinc-500 hover:text-zinc-800">
          ← {volver.texto}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
          {subtitulo && <p className="mt-1 text-sm text-zinc-500">{subtitulo}</p>}
        </div>
        {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
      </div>
    </div>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">{children}</div>;
}

const TONOS = {
  gris: "bg-zinc-100 text-zinc-700",
  verde: "bg-emerald-50 text-emerald-800",
  rojo: "bg-red-50 text-red-700",
  ambar: "bg-amber-50 text-amber-800",
  marca: "bg-marca-50 text-marca-700",
} as const;

export function Insignia({ tono = "gris", children }: { tono?: keyof typeof TONOS; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONOS[tono]}`}>{children}</span>;
}

export function Dato({ etiqueta, valor, detalle }: { etiqueta: string; valor: ReactNode; detalle?: ReactNode }) {
  return (
    <div className="tarjeta p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{etiqueta}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{valor}</div>
      {detalle && <div className="mt-0.5 text-xs text-zinc-500">{detalle}</div>}
    </div>
  );
}

export function InsigniaStock({ stock, minimo }: { stock: number; minimo: number }) {
  if (stock <= 0) return <Insignia tono="rojo">{stock}</Insignia>;
  if (stock <= minimo) return <Insignia tono="ambar">{stock}</Insignia>;
  return <Insignia tono="verde">{stock}</Insignia>;
}
