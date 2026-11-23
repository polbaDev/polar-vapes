"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { crearVenta } from "@/lib/actions/stock";
import { filtrarVariantes, porCodigo, type VarianteLigera } from "./buscador";
import { Foto } from "./foto";

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const PAGOS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "bizum", label: "Bizum" },
];

type Linea = { id: number; cantidad: number };

function aNumero(s: string) {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function Tpv({ variantes }: { variantes: VarianteLigera[] }) {
  const [q, setQ] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [pago, setPago] = useState("efectivo");
  const [descuento, setDescuento] = useState("");
  const [entregado, setEntregado] = useState("");
  const [mayorEdad, setMayorEdad] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<{ id: number; total: number; cambio: number | null } | null>(null);
  const [pendiente, startTransition] = useTransition();
  const buscador = useRef<HTMLInputElement>(null);
  const ticketRef = useRef<HTMLDivElement>(null);
  const [ticketVisible, setTicketVisible] = useState(false);

  // En el móvil, la barra flotante se oculta cuando el ticket ya está a la vista
  useEffect(() => {
    const el = ticketRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([e]) => setTicketVisible(e.isIntersecting), { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const porId = useMemo(() => new Map(variantes.map((v) => [v.id, v])), [variantes]);
  const resultados = useMemo(() => filtrarVariantes(variantes, q, 30), [variantes, q]);

  const subtotal = lineas.reduce((s, l) => s + l.cantidad * (porId.get(l.id)?.precio ?? 0), 0);
  const desc = Math.min(Math.max(aNumero(descuento), 0), subtotal);
  const total = Math.round((subtotal - desc) * 100) / 100;
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
  const cambio = pago === "efectivo" && entregado ? aNumero(entregado) - total : null;

  function enTicket(id: number) {
    return lineas.find((l) => l.id === id)?.cantidad ?? 0;
  }

  function anadir(v: VarianteLigera) {
    setHecho(null);
    setError(null);
    if (enTicket(v.id) >= v.stock) {
      setError(`De "${v.marca} ${v.modelo} ${v.sabor}" solo hay ${v.stock}.`);
      return;
    }
    setLineas((ls) =>
      ls.some((l) => l.id === v.id) ? ls.map((l) => (l.id === v.id ? { ...l, cantidad: l.cantidad + 1 } : l)) : [...ls, { id: v.id, cantidad: 1 }],
    );
    setQ("");
    buscador.current?.focus();
  }

  function cambiarCantidad(id: number, delta: number) {
    const v = porId.get(id);
    const n = enTicket(id) + delta;
    if (v && n > v.stock) {
      setError(`Solo hay ${v.stock} de ese producto.`);
      return;
    }
    setError(null);
    setLineas((ls) => ls.map((l) => (l.id === id ? { ...l, cantidad: n } : l)).filter((l) => l.cantidad > 0));
  }

  function onEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const exacto = porCodigo(variantes, q);
    if (exacto) return anadir(exacto);
    const disponibles = resultados.filter((r) => r.stock > 0);
    if (disponibles.length === 1) anadir(disponibles[0]);
  }

  function cobrar() {
    setError(null);
    if (lineas.length === 0) return setError("El ticket está vacío.");
    if (!mayorEdad) return setError("Marca la casilla de mayor de edad antes de cobrar.");
    startTransition(async () => {
      const r = await crearVenta({
        lineas: lineas.map((l) => ({ varianteId: l.id, cantidad: l.cantidad })),
        metodoPago: pago,
        descuento: desc,
        mayorEdad,
      });
      if (r?.error) {
        setError(r.error);
        return;
      }
      setHecho({ id: r!.id!, total: r!.total ?? total, cambio });
      setLineas([]);
      setDescuento("");
      setEntregado("");
      setMayorEdad(false);
      setPago("efectivo");
      buscador.current?.focus();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="min-w-0">
        <input
          ref={buscador}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onEnter}
          autoFocus
          placeholder="Buscar marca, sabor… o escanear código"
          className="campo py-3 text-base"
          aria-label="Buscar producto"
        />
        {hecho && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <span>
              Venta registrada: <strong>{eur.format(hecho.total)}</strong>
              {hecho.cambio !== null && hecho.cambio >= 0 && <> · Cambio: <strong>{eur.format(hecho.cambio)}</strong></>}
            </span>
            <Link href={`/ventas/${hecho.id}`} className="font-medium underline">
              Ver ticket
            </Link>
          </div>
        )}
        {variantes.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
            No hay productos activos. Créalos en <Link href="/catalogo" className="enlace">Catálogo</Link>.
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {resultados.map((v) => {
              const quedan = v.stock - enTicket(v.id);
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => anadir(v)}
                    disabled={quedan <= 0}
                    className="tarjeta flex w-full items-center gap-3 p-2 pr-3 text-left transition hover:border-marca-200 hover:bg-marca-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-white"
                  >
                    <Foto id={v.imagenId} color={v.color} alt="" texto={v.sabor} className="h-14 w-14 shrink-0 rounded-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{v.sabor}</span>
                      <span className="block truncate text-xs text-zinc-500">
                        {v.marca} {v.modelo} · {v.nicotinaMg} mg
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={`block font-semibold tabular-nums ${v.precio > 0 ? "" : "text-amber-700"}`}>
                        {v.precio > 0 ? eur.format(v.precio) : "sin precio"}
                      </span>
                      <span className={`block text-xs ${quedan <= 0 ? "text-red-600" : "text-zinc-500"}`}>
                        {quedan <= 0 ? "sin stock" : `quedan ${quedan}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {resultados.length === 0 && <li className="text-sm text-zinc-500">Nada coincide con “{q}”.</li>}
          </ul>
        )}
      </section>

      <aside ref={ticketRef} className="min-w-0 scroll-mt-20 lg:sticky lg:top-20 lg:self-start">
        <div className="tarjeta overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
            <h2 className="font-semibold">Ticket</h2>
            {lineas.length > 0 && (
              <button type="button" onClick={() => setLineas([])} className="text-sm text-zinc-500 hover:text-zinc-800">
                Vaciar
              </button>
            )}
          </div>
          {lineas.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-400">Toca un producto para añadirlo</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {lineas.map((l) => {
                const v = porId.get(l.id);
                if (!v) return null;
                return (
                  <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Foto id={v.imagenId} color={v.color} alt="" texto={v.sabor} className="h-10 w-10 shrink-0 rounded-md" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{v.sabor}</div>
                      <div className="truncate text-xs text-zinc-500">
                        {v.marca} {v.modelo} · {v.nicotinaMg} mg · {eur.format(v.precio)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => cambiarCantidad(l.id, -1)} className="btn-sec h-8 w-8 p-0" aria-label="Quitar uno">
                        −
                      </button>
                      <span className="w-6 text-center tabular-nums">{l.cantidad}</span>
                      <button type="button" onClick={() => cambiarCantidad(l.id, 1)} className="btn-sec h-8 w-8 p-0" aria-label="Añadir uno">
                        +
                      </button>
                    </div>
                    <div className="w-16 text-right text-sm font-medium tabular-nums">{eur.format(l.cantidad * v.precio)}</div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="space-y-3 border-t border-zinc-200 bg-zinc-50 px-4 py-4">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Subtotal ({unidades} uds.)</span>
              <span className="tabular-nums">{eur.format(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <label htmlFor="descuento" className="text-zinc-500">
                Descuento (€)
              </label>
              <input
                id="descuento"
                value={descuento}
                onChange={(e) => setDescuento(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                className="campo w-24 py-1 text-right"
              />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">Total</span>
              <span className="text-2xl font-semibold tabular-nums">{eur.format(total)}</span>
            </div>

            <div className="grid grid-cols-3 gap-1 rounded-lg bg-zinc-200/70 p-1" role="radiogroup" aria-label="Forma de pago">
              {PAGOS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  role="radio"
                  aria-checked={pago === p.value}
                  onClick={() => setPago(p.value)}
                  className={`rounded-md py-1.5 text-sm font-medium transition ${
                    pago === p.value ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {pago === "efectivo" && (
              <div className="flex items-center justify-between gap-3 text-sm">
                <label htmlFor="entregado" className="text-zinc-500">
                  Entrega
                </label>
                <input
                  id="entregado"
                  value={entregado}
                  onChange={(e) => setEntregado(e.target.value)}
                  inputMode="decimal"
                  placeholder="0,00"
                  className="campo w-24 py-1 text-right"
                />
                <span className={`w-24 text-right tabular-nums ${cambio !== null && cambio < 0 ? "text-red-600" : ""}`}>
                  {cambio === null ? "" : cambio < 0 ? `faltan ${eur.format(-cambio)}` : `cambio ${eur.format(cambio)}`}
                </span>
              </div>
            )}

            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <input type="checkbox" checked={mayorEdad} onChange={(e) => setMayorEdad(e.target.checked)} className="mt-0.5 h-4 w-4" />
              He comprobado que el cliente es mayor de edad
            </label>

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button type="button" onClick={cobrar} disabled={pendiente || lineas.length === 0} className="btn w-full py-3 text-base">
              {pendiente ? "Registrando…" : `Cobrar ${eur.format(total)}`}
            </button>
          </div>
        </div>
      </aside>

      {lineas.length > 0 && !ticketVisible && (
        <button
          type="button"
          onClick={() => ticketRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="fixed inset-x-4 bottom-20 z-10 flex items-center justify-between rounded-xl bg-zinc-900 px-4 py-3 text-white shadow-lg lg:hidden"
        >
          <span className="text-sm">{unidades} uds. en el ticket</span>
          <span className="font-semibold tabular-nums">{eur.format(total)} →</span>
        </button>
      )}
    </div>
  );
}
