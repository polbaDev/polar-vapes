"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { crearDevolucion } from "@/lib/actions/stock";
import { importesDevolucion } from "@/lib/devolucion-calculo";
import { tx } from "@/lib/i18n";
import { useT } from "./preferencias";

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", useGrouping: "always" });
const PAGOS = [
  { value: "efectivo", label: tx("Efectivo") },
  { value: "tarjeta", label: tx("Tarjeta") },
  { value: "bizum", label: tx("Bizum") },
];

export type LineaDevolvible = {
  id: number;
  sabor: string;
  detalle: string;
  cantidad: number;
  devueltas: number;
  precioUnidad: number;
};

export function FormDevolucion({
  ventaId,
  metodoPago,
  total,
  subtotal,
  yaDevuelto,
  lineas,
  socios = [],
  pagaPorDefecto = null,
}: {
  ventaId: number;
  metodoPago: string;
  total: number;
  subtotal: number;
  yaDevuelto: number;
  lineas: LineaDevolvible[];
  // Socios que pueden devolver el dinero (en mano, por Bizum…); por defecto, el que se quedó el de la venta
  socios?: { id: number; nombre: string }[];
  pagaPorDefecto?: number | null;
}) {
  const t = useT();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [paga, setPaga] = useState<number | null>(
    socios.find((s) => s.id === pagaPorDefecto)?.id ?? socios[0]?.id ?? null,
  );
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [metodo, setMetodo] = useState(metodoPago);
  const [destino, setDestino] = useState<"stock" | "defectuoso" | "">("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const quedan = (l: LineaDevolvible) => l.cantidad - l.devueltas;
  const { total: importe } = importesDevolucion(
    { total, subtotal, yaDevuelto },
    lineas.map((l) => ({ ...l, aDevolver: cantidades[l.id] ?? 0 })),
  );
  const unidades = Object.values(cantidades).reduce((s, n) => s + n, 0);
  // «efectivo», «tarjeta»… en minúscula, en el idioma de la pantalla
  const nombrePago = (valor: string) => t(PAGOS.find((p) => p.value === valor)?.label ?? valor).toLowerCase();

  function cambiar(l: LineaDevolvible, delta: number) {
    setCantidades((c) => ({ ...c, [l.id]: Math.min(Math.max((c[l.id] ?? 0) + delta, 0), quedan(l)) }));
  }

  function enviar() {
    setError(null);
    if (unidades === 0) return setError(t("Elige qué unidades te devuelven."));
    if (!destino) return setError(t("Elige si vuelven al stock o están defectuosas."));
    startTransition(async () => {
      const r = await crearDevolucion({
        ventaId,
        lineas: Object.entries(cantidades).map(([id, cantidad]) => ({ lineaVentaId: Number(id), cantidad })),
        metodoPago: metodo,
        vuelveAlStock: destino === "stock",
        motivo,
        pagaId: paga,
      });
      if (r?.error) return setError(r.error);
      setHecho(
        t("Devolución registrada: devuelve {importe} en {metodo}.", { importe: eur.format(r?.total ?? importe), metodo: nombrePago(metodo) }),
      );
      setCantidades({});
      setDestino("");
      setMotivo("");
      setAbierto(false);
      router.refresh();
    });
  }

  if (!abierto) {
    return (
      <div className="tarjeta mt-6 max-w-2xl p-4">
        {hecho && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{hecho}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">{t("Devolver productos")}</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {t("Si el cliente te devuelve una parte. Devuelves su dinero y decides si vuelven al stock.")}
            </p>
          </div>
          <button type="button" onClick={() => { setHecho(null); setAbierto(true); }} className="btn-sec">
            {t("Registrar devolución")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tarjeta mt-6 max-w-2xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <h2 className="font-semibold">{t("Devolver productos")}</h2>
        <button type="button" onClick={() => setAbierto(false)} className="text-sm text-zinc-500 hover:text-zinc-800">
          {t("Cancelar")}
        </button>
      </div>

      <ul className="divide-y divide-zinc-100">
        {lineas.map((l) => {
          const n = cantidades[l.id] ?? 0;
          const libres = quedan(l);
          return (
            <li key={l.id} className={`flex items-center gap-3 px-4 py-2.5 ${libres === 0 ? "opacity-50" : ""}`}>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{l.sabor}</div>
                <div className="text-xs text-zinc-500">
                  {l.detalle} ·{" "}
                  {libres === 0
                    ? t("ya devuelto todo")
                    : libres === 1
                      ? t("se puede devolver 1")
                      : t("se puede devolver {n}", { n: libres })}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => cambiar(l, -1)} disabled={n === 0} className="btn-sec h-8 w-8 p-0" aria-label={t("Una menos de {sabor}", { sabor: l.sabor })}>
                  −
                </button>
                <span className="w-6 text-center tabular-nums">{n}</span>
                <button type="button" onClick={() => cambiar(l, 1)} disabled={n >= libres} className="btn-sec h-8 w-8 p-0" aria-label={t("Una más de {sabor}", { sabor: l.sabor })}>
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="space-y-4 border-t border-zinc-200 bg-zinc-50 px-4 py-4">
        <fieldset>
          <legend className="etiqueta">{t("¿Qué haces con lo devuelto?")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-superficie p-3 text-sm has-[:checked]:border-marca-500 has-[:checked]:bg-marca-50">
              <input type="radio" name="destino" checked={destino === "stock"} onChange={() => setDestino("stock")} className="mt-0.5" />
              <span>
                <span className="block font-medium">{t("Vuelve al stock")}</span>
                <span className="text-zinc-500">{t("Está precintado o en buen estado")}</span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-superficie p-3 text-sm has-[:checked]:border-marca-500 has-[:checked]:bg-marca-50">
              <input type="radio" name="destino" checked={destino === "defectuoso"} onChange={() => setDestino("defectuoso")} className="mt-0.5" />
              <span>
                <span className="block font-medium">{t("Defectuoso")}</span>
                <span className="text-zinc-500">{t("No se vuelve a vender; su coste cuenta como pérdida")}</span>
              </span>
            </label>
          </div>
        </fieldset>

        <div>
          <div className="etiqueta">{t("Devuelves el dinero en")}</div>
          <div className="segmento grid grid-cols-3" role="radiogroup" aria-label={t("Cómo devuelves el dinero")}>
            {PAGOS.map((p) => (
              <button
                key={p.value}
                type="button"
                role="radio"
                aria-checked={metodo === p.value}
                onClick={() => setMetodo(p.value)}
                className="py-1.5"
              >
                {t(p.label)}
              </button>
            ))}
          </div>
          {metodo !== metodoPago && (
            <p className="mt-1 text-xs text-amber-700">{t("La venta se cobró en {metodo}.", { metodo: nombrePago(metodoPago) })}</p>
          )}
          {socios.length > 1 && (
            <div className="mt-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-zinc-500">{t("Lo devuelve")}</span>
              <div className="segmento" role="radiogroup" aria-label={t("Quién devuelve el dinero")}>
                {socios.map((s) => (
                  <button key={s.id} type="button" role="radio" aria-checked={paga === s.id} onClick={() => setPaga(s.id)} className="py-1">
                    {s.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="etiqueta" htmlFor="motivo_devolucion">
            {t("Motivo")} <span className="font-normal text-zinc-400">{t("(opcional)")}</span>
          </label>
          <input
            id="motivo_devolucion"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={t("Ej. no tira, sabor equivocado…")}
            className="campo"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="button" onClick={enviar} disabled={pendiente || unidades === 0} className="btn w-full py-3 text-base">
          {pendiente
            ? t("Registrando…")
            : unidades === 0
              ? t("Elige qué te devuelven")
              : t("Devolver {importe} ({n} uds.)", { importe: eur.format(importe), n: unidades })}
        </button>
        {total !== subtotal && (
          <p className="text-center text-xs text-zinc-500">{t("El descuento del ticket se reparte en proporción.")}</p>
        )}
      </div>
    </div>
  );
}
