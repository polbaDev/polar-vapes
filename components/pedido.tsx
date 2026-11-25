"use client";

import Link from "next/link";
import { useState } from "react";
import type { LineaPedido } from "@/lib/pedido";
import type { T } from "@/lib/i18n";
import { Foto } from "./foto";
import { useT } from "./preferencias";

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", useGrouping: "always" });
const num = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1, useGrouping: "always" });

function cantidad(s: string | undefined) {
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

function grupo(l: LineaPedido) {
  return `${l.marca} ${l.modelo} · ${l.nicotinaMg} mg`;
}

// Copia al portapapeles. Si la web no va por https (p. ej. desde el móvil por la red de la tienda),
// el navegador no deja usar el portapapeles moderno y se usa el método antiguo.
async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = texto;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

function estadoStock(l: LineaPedido, t: T) {
  if (l.stock <= 0) return { texto: t("agotado"), rojo: true };
  if (l.diasRestantes === null) return { texto: t("{stock} en stock", { stock: l.stock }), rojo: false };
  const d = Math.floor(l.diasRestantes);
  const texto =
    d < 1
      ? t("{stock} en stock · se acaba hoy", { stock: l.stock })
      : d === 1
        ? t("{stock} en stock · para ~1 día", { stock: l.stock })
        : t("{stock} en stock · para ~{dias} días", { stock: l.stock, dias: d });
  return { texto, rojo: d < 3 };
}

export function Pedido({
  lineas,
  ventana,
  fechaTexto,
  proveedor,
}: {
  lineas: LineaPedido[];
  ventana: number;
  fechaTexto: string;
  proveedor: { id: number; nombre: string; telefono: string | null } | null;
}) {
  const t = useT();
  const [cantidades, setCantidades] = useState<Record<number, string>>(() =>
    Object.fromEntries(lineas.filter((l) => l.sugerido > 0).map((l) => [l.varianteId, String(l.sugerido)])),
  );
  const [todos, setTodos] = useState(false);
  const [copiado, setCopiado] = useState<"si" | "no" | null>(null);

  const conSugerencia = lineas.filter((l) => l.sugerido > 0).length;
  // Se muestran los sugeridos y los que el usuario haya tocado; con «todos», el resto también
  const visibles = lineas.filter((l) => todos || l.sugerido > 0 || cantidades[l.varianteId] !== undefined);
  const porGrupoVisible = new Map<string, LineaPedido[]>();
  for (const l of visibles) porGrupoVisible.set(grupo(l), [...(porGrupoVisible.get(grupo(l)) ?? []), l]);
  const grupos = [...porGrupoVisible.entries()];

  const pedidas = lineas.filter((l) => cantidad(cantidades[l.varianteId]) > 0);
  const unidades = pedidas.reduce((s, l) => s + cantidad(cantidades[l.varianteId]), 0);
  const coste = pedidas.reduce((s, l) => s + (l.coste ?? 0) * cantidad(cantidades[l.varianteId]), 0);
  const sinCoste = pedidas.some((l) => l.coste === null);

  // Texto para el proveedor (los asteriscos salen en negrita en WhatsApp)
  const porGrupoPedido = new Map<string, string[]>();
  for (const l of pedidas) {
    porGrupoPedido.set(grupo(l), [...(porGrupoPedido.get(grupo(l)) ?? []), `- ${l.sabor}: ${cantidad(cantidades[l.varianteId])}`]);
  }
  const bloques = [...porGrupoPedido.entries()].map(([g, filas]) => `*${g}*\n${filas.join("\n")}`);
  const total = unidades === 1 ? t("Total: 1 unidad") : t("Total: {n} unidades", { n: unidades });
  const texto =
    pedidas.length === 0
      ? ""
      : `${t("Hola, te paso el pedido ({fecha}):", { fecha: fechaTexto })}\n\n${bloques.join("\n\n")}\n\n${total}`;

  const whatsapp = `https://wa.me/${proveedor?.telefono ?? ""}?text=${encodeURIComponent(texto)}`;
  const enlaceCompra = `/compras/nueva?${proveedor ? `proveedor=${proveedor.id}&` : ""}lineas=${pedidas
    .map((l) => `${l.varianteId}:${cantidad(cantidades[l.varianteId])}`)
    .join(",")}`;

  async function alCopiar() {
    setCopiado((await copiar(texto)) ? "si" : "no");
    setTimeout(() => setCopiado(null), 2500);
  }

  if (lineas.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 bg-superficie px-4 py-10 text-center text-sm text-zinc-500">
        {t("No hay productos activos con estos filtros.")}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-zinc-600">
            {conSugerencia === 0
              ? t("Con estos datos no hace falta pedir nada.")
              : conSugerencia === 1
                ? t("1 sabor por pedir.")
                : t("{n} sabores por pedir.", { n: conSugerencia })}
          </span>
          {lineas.length > conSugerencia && (
            <label className="flex items-center gap-2 text-zinc-600">
              <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} className="h-4 w-4" />
              {t("Ver también los que no hace falta pedir ({n})", { n: lineas.length - conSugerencia })}
            </label>
          )}
        </div>

        {grupos.map(([g, filas]) => (
          <div key={g} className="tarjeta overflow-hidden">
            <h2 className="border-b border-zinc-200 px-4 py-2.5 text-sm font-semibold">{g}</h2>
            <ul className="divide-y divide-zinc-100">
              {filas.map((l) => {
                const est = estadoStock(l, t);
                const n = cantidad(cantidades[l.varianteId]);
                return (
                  <li key={l.varianteId} className="flex items-center gap-3 px-4 py-2.5">
                    <Foto id={l.imagenId} color={l.color} alt="" texto={l.sabor} className="h-10 w-10 shrink-0 rounded-md" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{l.sabor}</div>
                      <div className="text-xs text-zinc-500">
                        <span className={est.rojo ? "font-medium text-red-600" : ""}>{est.texto}</span>
                        {" · "}
                        {l.vendidas === 0
                          ? t("sin ventas en {dias} días", { dias: ventana })
                          : t("vende {n} a la semana", { n: num.format(l.porSemana) })}
                      </div>
                    </div>
                    <div className="hidden w-20 text-right text-xs tabular-nums text-zinc-500 sm:block">
                      {l.coste !== null && n > 0 ? eur.format(l.coste * n) : ""}
                    </div>
                    <input
                      value={cantidades[l.varianteId] ?? ""}
                      onChange={(e) => setCantidades((c) => ({ ...c, [l.varianteId]: e.target.value.replace(/\D/g, "") }))}
                      inputMode="numeric"
                      placeholder="0"
                      aria-label={t("Unidades de {sabor}", { sabor: l.sabor })}
                      className={`campo w-16 shrink-0 px-2 py-1 text-right tabular-nums ${n > 0 ? "border-marca-500 font-semibold" : ""}`}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
        <div className="tarjeta space-y-4 p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">{proveedor ? t("Tu pedido a {proveedor}", { proveedor: proveedor.nombre }) : t("Tu pedido")}</h2>
            <span className="text-sm tabular-nums text-zinc-500">{t("{n} uds.", { n: unidades })}</span>
          </div>
          {pedidas.length === 0 ? (
            <p className="text-sm text-zinc-500">{t("Pon cantidades en los sabores que quieras pedir.")}</p>
          ) : (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">{t("Coste aproximado")}</span>
                <span className="font-medium tabular-nums">{eur.format(coste)}</span>
              </div>
              {sinCoste && <p className="-mt-2 text-xs text-zinc-500">{t("Algunos sabores aún no tienen coste: no cuentan en el total.")}</p>}
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 font-sans text-sm text-zinc-800">{texto}</pre>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={alCopiar} className="btn-sec">
                  {copiado === "si" ? t("Copiado ✓") : copiado === "no" ? t("No se pudo") : t("Copiar")}
                </button>
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn">
                  WhatsApp
                </a>
              </div>
              {proveedor && !proveedor.telefono && (
                <p className="text-xs text-zinc-500">
                  {t("{proveedor} no tiene un móvil válido guardado: WhatsApp te dejará elegir a quién enviarlo.", {
                    proveedor: proveedor.nombre,
                  })}
                </p>
              )}
              <div className="border-t border-zinc-100 pt-3">
                <Link href={enlaceCompra} className="enlace text-sm">
                  {t("Cuando llegue, regístralo como compra →")}
                </Link>
                <p className="mt-1 text-xs text-zinc-500">
                  {t("Se abre la compra con estos sabores y cantidades; solo tendrás que revisar los costes.")}
                </p>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
