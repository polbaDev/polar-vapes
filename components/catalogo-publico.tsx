"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { crearReserva } from "@/lib/actions/reservas";
import type { ArticuloCatalogo } from "@/lib/reservas";
import { nombreModelo, normalizar } from "./buscador";
import { Foto } from "./foto";

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const num = new Intl.NumberFormat("es-ES");

const NIVEL = {
  disponible: { texto: "Disponible", clase: "bg-emerald-50 text-emerald-800" },
  pocas: { texto: "Últimas unidades", clase: "bg-amber-50 text-amber-800" },
  agotado: { texto: "Agotado", clase: "bg-zinc-100 text-zinc-500" },
} as const;

function duracion(minutos: number) {
  if (minutos < 60) return `${minutos} minutos`;
  const h = Math.round(minutos / 60);
  return h === 1 ? "1 hora" : `${h} horas`;
}

export function CatalogoPublico({
  articulos,
  base,
  maxUnidades,
  minutosConfirmar,
  info,
}: {
  articulos: ArticuloCatalogo[];
  base: string;
  maxUnidades: number;
  minutosConfirmar: number;
  info: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [web, setWeb] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const porId = new Map(articulos.map((a) => [a.id, a]));
  const elegidos = Object.entries(cantidades)
    .map(([id, n]) => ({ a: porId.get(Number(id))!, n }))
    .filter((x) => x.a && x.n > 0);
  const unidades = elegidos.reduce((s, x) => s + x.n, 0);
  const total = elegidos.reduce((s, x) => s + x.n * x.a.precio, 0);

  const terminos = normalizar(q).split(/\s+/).filter(Boolean);
  const visibles = articulos.filter((a) => {
    if (terminos.length === 0) return true;
    const t = normalizar(`${a.marca} ${a.modelo} ${a.sabor} ${a.nicotinaMg}mg`);
    return terminos.every((x) => t.includes(x));
  });
  // Agrupados por modelo, lo agotado al final de cada grupo
  const grupos = new Map<number, ArticuloCatalogo[]>();
  for (const a of visibles) grupos.set(a.productoId, [...(grupos.get(a.productoId) ?? []), a]);
  for (const lista of grupos.values()) lista.sort((x, y) => Number(x.nivel === "agotado") - Number(y.nivel === "agotado"));

  function cambiar(a: ArticuloCatalogo, delta: number) {
    setError(null);
    setCantidades((c) => {
      const actual = c[a.id] ?? 0;
      const resto = unidades - actual;
      const n = Math.max(0, Math.min(actual + delta, a.maximo, maxUnidades - resto));
      return { ...c, [a.id]: n };
    });
  }

  function reservar() {
    setError(null);
    if (nombre.trim().length < 2) return setError("Escribe tu nombre.");
    startTransition(async () => {
      const r = await crearReserva({
        nombre,
        web,
        lineas: elegidos.map((x) => ({ varianteId: x.a.id, cantidad: x.n })),
      });
      if (r?.error || !r?.codigo) {
        setError(r?.error ?? "No se pudo hacer la reserva.");
        router.refresh();
        return;
      }
      router.push(`${base}/r/${r.codigo}`);
    });
  }

  if (articulos.length === 0) {
    return <p className="py-16 text-center text-sm text-zinc-500">Todavía no hay productos en el catálogo.</p>;
  }

  return (
    <>
      <div className="mb-4 rounded-xl border border-marca-100 bg-marca-50 px-4 py-3 text-sm text-marca-900">
        Elige lo que quieres y pulsa <strong>Reservar</strong>. Te apartamos los productos durante {duracion(minutosConfirmar)}; para
        confirmar la reserva, envíanos el código por WhatsApp.
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar sabor o modelo…"
        className="campo mb-5 py-3"
        aria-label="Buscar en el catálogo"
      />

      {grupos.size === 0 && <p className="text-sm text-zinc-500">Nada coincide con “{q}”.</p>}

      <div className="space-y-8">
        {[...grupos.values()].map((lista) => {
          const p = lista[0];
          const nicotinas = [...new Set(lista.map((a) => a.nicotinaMg))].join(" / ");
          return (
            <section key={p.productoId}>
              <div className="mb-3">
                <h2 className="text-lg font-semibold">{nombreModelo(p)}</h2>
                <p className="text-sm text-zinc-500">
                  {[p.caladas ? `${num.format(p.caladas)} caladas` : null, `${nicotinas} mg`].filter(Boolean).join(" · ")}
                </p>
              </div>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {lista.map((a) => {
                  const n = cantidades[a.id] ?? 0;
                  const agotado = a.nivel === "agotado";
                  return (
                    <li key={a.id} className={`tarjeta flex flex-col overflow-hidden ${agotado ? "opacity-60" : ""}`}>
                      <Foto id={a.imagenId} color={a.color} alt={a.sabor} texto={a.sabor} className="aspect-square w-full" />
                      <div className="flex flex-1 flex-col p-3">
                        <h3 className="text-sm font-medium leading-snug">{a.sabor}</h3>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="font-semibold tabular-nums">{eur.format(a.precio)}</span>
                          {/* La nicotina solo hace falta si el modelo la tiene en varias cantidades */}
                          {nicotinas.includes("/") && <span className="text-xs text-zinc-500">{a.nicotinaMg} mg</span>}
                        </div>
                        <span className={`mt-2 inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium ${NIVEL[a.nivel].clase}`}>
                          {NIVEL[a.nivel].texto}
                        </span>
                        <div className="mt-auto pt-3">
                          {agotado ? null : n === 0 ? (
                            <button type="button" onClick={() => cambiar(a, 1)} disabled={unidades >= maxUnidades} className="btn-sec w-full py-1.5 text-sm">
                              Añadir
                            </button>
                          ) : (
                            <div className="flex items-center justify-between">
                              <button type="button" onClick={() => cambiar(a, -1)} className="btn-sec h-9 w-9 p-0" aria-label={`Una menos de ${a.sabor}`}>
                                −
                              </button>
                              <span className="font-semibold tabular-nums">{n}</span>
                              <button
                                type="button"
                                onClick={() => cambiar(a, 1)}
                                disabled={n >= a.maximo || unidades >= maxUnidades}
                                className="btn-sec h-9 w-9 p-0"
                                aria-label={`Una más de ${a.sabor}`}
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {unidades > 0 && !abierto && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
          <button type="button" onClick={() => setAbierto(true)} className="btn mx-auto flex w-full max-w-3xl justify-between py-3 text-base">
            <span>Reservar ({unidades} uds.)</span>
            <span className="tabular-nums">{eur.format(total)} →</span>
          </button>
        </div>
      )}

      {abierto && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-zinc-900/50 sm:items-center" onClick={() => !pendiente && setAbierto(false)}>
          <div
            className="max-h-[90dvh] w-full max-w-md overflow-auto rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-reserva"
          >
            <div className="flex items-center justify-between">
              <h2 id="titulo-reserva" className="text-lg font-semibold">
                Tu reserva
              </h2>
              <button type="button" onClick={() => setAbierto(false)} className="text-sm text-zinc-500" disabled={pendiente}>
                Seguir mirando
              </button>
            </div>
            <ul className="mt-3 divide-y divide-zinc-100 text-sm">
              {elegidos.map(({ a, n }) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="font-medium">
                      {n} × {a.sabor}
                    </span>
                    <span className="block truncate text-xs text-zinc-500">
                      {nombreModelo(a)} · {a.nicotinaMg} mg
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{eur.format(n * a.precio)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between border-t border-zinc-200 pt-2 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{eur.format(total)}</span>
            </div>

            <label className="etiqueta mt-4" htmlFor="nombre_reserva">
              Tu nombre
            </label>
            <input
              id="nombre_reserva"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={60}
              autoComplete="given-name"
              className="campo"
            />
            {/* Campo trampa para robots: las personas no lo ven */}
            <input
              value={web}
              onChange={(e) => setWeb(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute left-[-9999px] h-0 w-0 opacity-0"
              name="web"
            />

            <p className="mt-3 text-xs text-zinc-500">
              Te apartamos estos productos durante {duracion(minutosConfirmar)}. En la siguiente pantalla tendrás tu código y un botón para
              enviárnoslo por WhatsApp; la venta la cerramos por ahí.
            </p>
            {info && <p className="mt-2 whitespace-pre-line text-xs text-zinc-500">{info}</p>}

            {error && (
              <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <button type="button" onClick={reservar} disabled={pendiente} className="btn mt-4 w-full py-3 text-base">
              {pendiente ? "Reservando…" : "Reservar"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
