"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { crearVenta } from "@/lib/actions/stock";
import { filtrarVariantes, nombreModelo, porCodigo, type VarianteLigera } from "./buscador";
import { BotonCamara, Escaner, useCamaraDisponible } from "./escaner";
import { Foto } from "./foto";
import { useT } from "./preferencias";
import { redondear } from "@/lib/format";
import { tx } from "@/lib/i18n";

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const PAGOS = [
  { value: "efectivo", label: tx("Efectivo") },
  { value: "tarjeta", label: tx("Tarjeta") },
  { value: "bizum", label: tx("Bizum") },
];
// Sin buscar, se enseñan los más vendidos hasta este número
const MAX_TODOS = 60;
// Si el cobro no contesta en este tiempo, se da por perdida la respuesta y se desbloquea el ticket
const ESPERA_COBRO = 20000;

type Linea = { id: number; cantidad: number };

function aNumero(s: string) {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function aTexto(n: number) {
  return n.toFixed(2).replace(".", ",");
}

// Unidades que se pueden vender: el stock menos lo apartado en reservas de otros clientes
const libres = (v: VarianteLigera) => v.stock - v.reservado;
const vendible = (v: VarianteLigera) => libres(v) > 0 && v.precio > 0;

export type ReservaEnTpv = { id: number; codigo: string; nombre: string; lineas: { varianteId: number; cantidad: number }[] };

// Importes típicos que te puede dar el cliente: el justo y el siguiente billete redondo
function entregasRapidas(total: number) {
  if (total <= 0) return [];
  const opciones = new Set([Math.round(total * 100) / 100]);
  for (const paso of [5, 10, 20, 50, 100]) {
    const r = Math.ceil(total / paso) * paso;
    if (r > total) opciones.add(r);
  }
  return [...opciones].sort((a, b) => a - b).slice(0, 4);
}

// Clave de un intento de cobro. Por http://192.168… (sin https) el navegador no tiene randomUUID.
function nuevaClave() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export type SocioEnTpv = { id: number; nombre: string };

export function Tpv({
  variantes,
  reserva = null,
  socios = [],
  yo,
  tarjetaA = null,
}: {
  variantes: VarianteLigera[];
  reserva?: ReservaEnTpv | null;
  // Socios a los que les puede llegar un Bizum (a su móvil)
  socios?: SocioEnTpv[];
  // Cuenta de quien cobra
  yo: number;
  // Socio al que le llega lo cobrado con tarjeta (null: cuenta de la tienda)
  tarjetaA?: string | null;
}) {
  const t = useT();
  const router = useRouter();
  // El Bizum le llega por defecto a quien cobra (si es socio)
  const recibePorDefecto = socios.find((s) => s.id === yo)?.id ?? socios[0]?.id ?? null;
  const [recibe, setRecibe] = useState<number | null>(recibePorDefecto);
  const [q, setQ] = useState("");
  const [producto, setProducto] = useState<number | null>(null);
  // Al cobrar una reserva, el ticket empieza con sus productos (se pueden cambiar)
  const [reservaActiva, setReservaActiva] = useState(reserva);
  const [lineas, setLineas] = useState<Linea[]>(() =>
    (reserva?.lineas ?? []).filter((l) => variantes.some((v) => v.id === l.varianteId)).map((l) => ({ id: l.varianteId, cantidad: l.cantidad })),
  );
  const [pago, setPago] = useState("efectivo");
  const [descuento, setDescuento] = useState("");
  const [entregado, setEntregado] = useState("");
  const [mayorEdad, setMayorEdad] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<{ id: number; total: number; cambio: number | null; repetida: boolean } | null>(null);
  // Sin useTransition: si el cobro se queda colgado, la transición seguiría pendiente aunque venza el plazo
  const [pendiente, setPendiente] = useState(false);
  // Último cobro sin confirmar: si se reintenta el mismo ticket, va con la misma clave
  const intento = useRef<{ clave: string; huella: string } | null>(null);
  const [escaneando, setEscaneando] = useState(false);
  const camara = useCamaraDisponible();
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

  // Al recargar el catálogo, lo que ya no está a la venta (desactivado) sale del ticket: no se vería y no se podría cobrar
  useEffect(() => {
    if (lineas.every((l) => porId.has(l.id))) return;
    setLineas((ls) => ls.filter((l) => porId.has(l.id)));
    setError(t("Se han quitado del ticket productos que ya no están a la venta."));
  }, [porId]);

  // Modelos para los botones de filtro, los que más se venden primero
  const productos = useMemo(() => {
    const m = new Map<number, { id: number; nombre: string; vendidas: number }>();
    for (const v of variantes) {
      const p = m.get(v.productoId) ?? { id: v.productoId, nombre: nombreModelo(v), vendidas: 0 };
      p.vendidas += v.vendidas;
      m.set(v.productoId, p);
    }
    return [...m.values()].sort((a, b) => b.vendidas - a.vendidas || a.nombre.localeCompare(b.nombre, "es"));
  }, [variantes]);

  const { resultados, recortados } = useMemo(() => {
    // Lo que se puede vender va primero; el orden es estable, así que dentro se respeta el de la lista
    const primeroVendibles = (l: VarianteLigera[]) => [...l].sort((a, b) => Number(vendible(b)) - Number(vendible(a)));
    if (q.trim()) return { resultados: primeroVendibles(filtrarVariantes(variantes, q, 40)), recortados: false };
    if (producto !== null) {
      const delModelo = variantes.filter((v) => v.productoId === producto);
      return { resultados: primeroVendibles(delModelo), recortados: false };
    }
    const todos = [...variantes].sort((a, b) => Number(vendible(b)) - Number(vendible(a)) || b.vendidas - a.vendidas);
    return { resultados: todos.slice(0, MAX_TODOS), recortados: todos.length > MAX_TODOS };
  }, [variantes, q, producto]);

  // En céntimos, como lo guarda el servidor (si no, el total podría no cuadrar con el suyo o salir -0,00 €)
  const subtotal = redondear(lineas.reduce((s, l) => s + l.cantidad * (porId.get(l.id)?.precio ?? 0), 0));
  const desc = redondear(Math.min(Math.max(aNumero(descuento), 0), subtotal));
  const total = redondear(subtotal - desc);
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
  const cambio = pago === "efectivo" && entregado ? aNumero(entregado) - total : null;

  // Si el ticket cambia, la clave del último intento ya no vale: otro ticket igual puede ser otra venta
  useEffect(() => {
    intento.current = null;
  }, [lineas, pago, desc, reservaActiva?.id, recibe]);

  function enTicket(id: number) {
    return lineas.find((l) => l.id === id)?.cantidad ?? 0;
  }

  // Devuelve el motivo si no se puede añadir
  function motivoNoAnadir(v: VarianteLigera) {
    if (v.precio <= 0) return t('"{nombre}" no tiene precio de venta. Pónselo en Catálogo.', { nombre: v.sabor });
    if (enTicket(v.id) >= libres(v)) {
      if (v.stock <= 0) return t('No queda stock de "{nombre}".', { nombre: v.sabor });
      if (v.reservado > 0) {
        return t('De "{nombre}" quedan {stock}, pero {reservado} están apartadas en reservas.', {
          nombre: v.sabor,
          stock: v.stock,
          reservado: v.reservado,
        });
      }
      return t('De "{nombre}" solo hay {stock}.', { nombre: v.sabor, stock: v.stock });
    }
    return null;
  }

  function anadir(v: VarianteLigera) {
    // Mientras se registra la venta el ticket no se toca: lo que se añadiera se perdería al terminar
    if (pendiente) return false;
    setHecho(null);
    const motivo = motivoNoAnadir(v);
    if (motivo) {
      setError(motivo);
      return false;
    }
    setError(null);
    setLineas((ls) =>
      ls.some((l) => l.id === v.id) ? ls.map((l) => (l.id === v.id ? { ...l, cantidad: l.cantidad + 1 } : l)) : [...ls, { id: v.id, cantidad: 1 }],
    );
    setQ("");
    if (!escaneando) buscador.current?.focus();
    return true;
  }

  function leerCodigo(codigo: string) {
    if (pendiente) return t("Espera a que se registre la venta.");
    const v = porCodigo(variantes, codigo);
    if (!v) {
      setError(t("El código {codigo} no está en el catálogo. Puedes añadírselo al sabor en Catálogo.", { codigo }));
      return t("No está en el catálogo: {codigo}", { codigo });
    }
    const motivo = motivoNoAnadir(v);
    anadir(v);
    return motivo ?? t("Añadido: {sabor} ({modelo})", { sabor: v.sabor, modelo: nombreModelo(v) });
  }

  function cambiarCantidad(id: number, delta: number) {
    const v = porId.get(id);
    const n = enTicket(id) + delta;
    if (v && n > libres(v)) {
      setError(
        v.reservado > 0
          ? t("Solo hay {libres} libres de ese producto ({reservado} apartadas en reservas).", {
              libres: Math.max(libres(v), 0),
              reservado: v.reservado,
            })
          : t("Solo hay {stock} de ese producto.", { stock: v.stock }),
      );
      return;
    }
    setError(null);
    setLineas((ls) => ls.map((l) => (l.id === id ? { ...l, cantidad: n } : l)).filter((l) => l.cantidad > 0));
  }

  function onEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    // Los lectores de códigos USB/Bluetooth escriben el código y pulsan Intro
    const exacto = porCodigo(variantes, q);
    if (exacto) return void anadir(exacto);
    const disponibles = resultados.filter(vendible);
    if (disponibles.length === 1) anadir(disponibles[0]);
  }

  function vaciar() {
    if (unidades > 2 && !window.confirm(t("¿Vaciar el ticket?"))) return;
    setLineas([]);
    setError(null);
  }

  async function cobrar() {
    if (pendiente) return;
    setError(null);
    if (lineas.length === 0) return setError(t("El ticket está vacío."));
    if (!mayorEdad) return setError(t("Marca la casilla de mayor de edad antes de cobrar."));
    // Mismo ticket que el último intento sin confirmar → misma clave: si aquel se guardó, no se cobra dos veces
    const recibeId = pago === "bizum" ? recibe : null;
    const huella = JSON.stringify([
      [...lineas].sort((a, b) => a.id - b.id).map((l) => [l.id, l.cantidad]),
      pago,
      desc,
      reservaActiva?.id ?? null,
      total,
      recibeId,
    ]);
    if (intento.current?.huella !== huella) intento.current = { clave: nuevaClave(), huella };
    const clave = intento.current.clave;
    setPendiente(true);
    let r: Awaited<ReturnType<typeof crearVenta>>;
    // Sin límite, una conexión colgada dejaría el ticket bloqueado en «Registrando…» hasta recargar (y perder la clave).
    // Next encola las acciones: un reintento espera a que acabe la anterior, y como lleva la misma clave no duplica.
    let reloj: ReturnType<typeof setTimeout> | undefined;
    let agotado = false;
    try {
      r = await Promise.race([
        crearVenta({
          lineas: lineas.map((l) => ({ varianteId: l.id, cantidad: l.cantidad })),
          metodoPago: pago,
          descuento: desc,
          mayorEdad,
          reservaId: reservaActiva?.id ?? null,
          clave,
          totalEsperado: total,
          recibeId,
        }),
        new Promise<never>((_, rechazar) => {
          reloj = setTimeout(() => {
            agotado = true;
            rechazar(new Error("Sin respuesta"));
          }, ESPERA_COBRO);
        }),
      ]);
    } catch (e) {
      // El ticket se queda como está; al volver a cobrar sin tocarlo va la misma clave.
      if (agotado || e instanceof TypeError) {
        // Sin respuesta (se ha cortado la wifi o el servidor no contesta): puede que se guardara o no
        setError(
          t("No se ha podido confirmar el cobro. Comprueba la conexión y pulsa Cobrar otra vez: si ya se había guardado, no se cobrará dos veces."),
        );
      } else {
        // El servidor ha contestado con un error que no se arregla reintentando: sesión caducada, app actualizada…
        setError(
          t("No se ha podido cobrar. Recarga la página (puede que tengas que volver a entrar) y, antes de cobrar otra vez, mira en Ventas si se ha guardado."),
        );
      }
      return;
    } finally {
      clearTimeout(reloj);
      setPendiente(false);
    }
    if (r?.error) {
      setError(r.error);
      // Puede que hayan cambiado precios, stock o la reserva: se recarga el catálogo y el ticket enseña los de ahora
      router.refresh();
      return;
    }
    intento.current = null;
    // El cambio sale del total que ha cobrado el servidor
    const cobrado = r?.total ?? total;
    setHecho({
      id: r!.id!,
      total: cobrado,
      cambio: pago === "efectivo" && entregado ? aNumero(entregado) - cobrado : null,
      repetida: Boolean(r?.repetida),
    });
    if (reservaActiva) {
      setReservaActiva(null);
      router.replace("/ventas/nueva");
    }
    setLineas([]);
    setDescuento("");
    setEntregado("");
    setMayorEdad(false);
    setPago("efectivo");
    setRecibe(recibePorDefecto);
    buscador.current?.focus();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="min-w-0">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              ref={buscador}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onEnter}
              autoFocus
              placeholder={t("Buscar marca, sabor… o escanear código")}
              className="campo py-3 pr-10 text-base"
              aria-label={t("Buscar producto")}
            />
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  buscador.current?.focus();
                }}
                className="absolute inset-y-0 right-0 px-3 text-zinc-400 hover:text-zinc-700"
                aria-label={t("Borrar búsqueda")}
              >
                ✕
              </button>
            )}
          </div>
          {camara && <BotonCamara onClick={() => setEscaneando(true)} />}
        </div>

        {productos.length > 1 && !q.trim() && (
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label={t("Filtrar por modelo")}>
            {[{ id: null, nombre: t("Más vendidos") }, ...productos].map((p) => (
              <button
                key={p.id ?? "todos"}
                type="button"
                onClick={() => setProducto(p.id)}
                aria-pressed={producto === p.id}
                className="chip shrink-0"
              >
                {p.nombre}
              </button>
            ))}
          </div>
        )}

        {hecho && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <span>
              {hecho.repetida ? t("La venta #{id} ya estaba registrada (no se ha cobrado dos veces):", { id: hecho.id }) : t("Venta registrada:")}{" "}
              <strong>{eur.format(hecho.total)}</strong>
              {hecho.cambio !== null && hecho.cambio >= 0 && (
                <>
                  {" "}
                  · {t("Cambio:")} <strong>{eur.format(hecho.cambio)}</strong>
                </>
              )}
            </span>
            <Link href={`/ventas/${hecho.id}`} className="font-medium underline">
              {t("Ver ticket")}
            </Link>
          </div>
        )}
        {variantes.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-superficie p-6 text-center text-sm text-zinc-500">
            {t("No hay productos activos. Créalos en")}{" "}
            <Link href="/catalogo" className="enlace">
              {t("Catálogo")}
            </Link>
            .
          </p>
        ) : (
          <>
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {resultados.map((v) => {
                const quedan = libres(v) - enTicket(v.id);
                const sinPrecio = v.precio <= 0;
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => anadir(v)}
                      disabled={pendiente || quedan <= 0 || sinPrecio}
                      className="tarjeta flex w-full items-center gap-3 p-2 pr-3 text-left transition hover:border-marca-200 hover:bg-marca-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-superficie"
                    >
                      <Foto id={v.imagenId} color={v.color} alt="" texto={v.sabor} className="h-14 w-14 shrink-0 rounded-lg" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{v.sabor}</span>
                        <span className="block truncate text-xs text-zinc-500">
                          {nombreModelo(v)} · {v.nicotinaMg} mg
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className={`block font-semibold tabular-nums ${sinPrecio ? "text-amber-700" : ""}`}>
                          {sinPrecio ? t("sin precio") : eur.format(v.precio)}
                        </span>
                        <span className={`block text-xs ${quedan <= 0 ? "text-red-600" : "text-zinc-500"}`}>
                          {quedan <= 0
                            ? v.reservado > 0 && v.stock > 0
                              ? t("todo reservado")
                              : t("sin stock")
                            : quedan === 1
                              ? t("queda 1")
                              : t("quedan {n}", { n: quedan })}
                        </span>
                        {v.reservado > 0 && (
                          <span className="block text-xs text-amber-700">
                            {v.reservado === 1 ? t("1 reservada") : t("{n} reservadas", { n: v.reservado })}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
              {resultados.length === 0 && <li className="text-sm text-zinc-500">{t("Nada coincide con “{busqueda}”.", { busqueda: q })}</li>}
            </ul>
            {recortados && (
              <p className="mt-3 text-center text-xs text-zinc-500">
                {t("Se muestran los {n} más vendidos. Busca o elige un modelo para ver el resto.", { n: MAX_TODOS })}
              </p>
            )}
          </>
        )}
      </section>

      <aside ref={ticketRef} className="min-w-0 scroll-mt-20 lg:sticky lg:top-20 lg:self-start">
        <div className="tarjeta overflow-hidden">
          {reservaActiva && (
            <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
              <span>
                {t("Cobrando la reserva")} <strong className="font-mono">{reservaActiva.codigo}</strong>{" "}
                {t("de {cliente}", { cliente: reservaActiva.nombre })}
              </span>
              <button
                type="button"
                onClick={() => {
                  setReservaActiva(null);
                  router.replace("/ventas/nueva");
                }}
                disabled={pendiente}
                className="shrink-0 text-xs underline disabled:cursor-not-allowed disabled:opacity-45"
              >
                {t("Quitar")}
              </button>
            </div>
          )}
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
            <h2 className="font-semibold">{t("Ticket")}</h2>
            {lineas.length > 0 && (
              <button
                type="button"
                onClick={vaciar}
                disabled={pendiente}
                className="text-sm text-zinc-500 hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:text-zinc-500"
              >
                {t("Vaciar")}
              </button>
            )}
          </div>
          {lineas.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-400">{t("Toca un producto para añadirlo")}</p>
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
                        {nombreModelo(v)} · {v.nicotinaMg} mg · {eur.format(v.precio)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(l.id, -1)}
                        disabled={pendiente}
                        className="btn-sec h-8 w-8 p-0"
                        aria-label={t("Quitar uno")}
                      >
                        −
                      </button>
                      <span className="w-6 text-center tabular-nums">{l.cantidad}</span>
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(l.id, 1)}
                        disabled={pendiente}
                        className="btn-sec h-8 w-8 p-0"
                        aria-label={t("Añadir uno")}
                      >
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
              <span className="text-zinc-500">{t("Subtotal ({n} uds.)", { n: unidades })}</span>
              <span className="tabular-nums">{eur.format(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <label htmlFor="descuento" className="text-zinc-500">
                {t("Descuento (€)")}
              </label>
              <input
                id="descuento"
                value={descuento}
                onChange={(e) => setDescuento(e.target.value)}
                disabled={pendiente}
                inputMode="decimal"
                placeholder="0"
                className="campo w-24 py-1 text-right"
              />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">{t("Total")}</span>
              <span className="text-2xl font-semibold tabular-nums">{eur.format(total)}</span>
            </div>

            <div className="segmento grid grid-cols-3" role="radiogroup" aria-label={t("Forma de pago")}>
              {PAGOS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  role="radio"
                  aria-checked={pago === p.value}
                  onClick={() => setPago(p.value)}
                  disabled={pendiente}
                  className="py-1.5 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {t(p.label)}
                </button>
              ))}
            </div>

            {pago === "bizum" && socios.length > 1 && (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-zinc-500">{t("Le llega a")}</span>
                <div className="segmento" role="radiogroup" aria-label={t("A quién le llega el Bizum")}>
                  {socios.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={recibe === s.id}
                      onClick={() => setRecibe(s.id)}
                      disabled={pendiente}
                      className="py-1 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {s.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {pago === "bizum" && socios.length === 1 && (
              <p className="text-xs text-zinc-500">{t("Le llega a {nombre}.", { nombre: socios[0].nombre })}</p>
            )}
            {pago === "tarjeta" && (
              <p className="text-xs text-zinc-500">
                {tarjetaA ? t("Entra en la cuenta de {nombre}.", { nombre: tarjetaA }) : t("Entra en la cuenta de la tienda.")}
              </p>
            )}

            {pago === "efectivo" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <label htmlFor="entregado" className="text-zinc-500">
                    {t("Entrega")}
                  </label>
                  <input
                    id="entregado"
                    value={entregado}
                    onChange={(e) => setEntregado(e.target.value)}
                    disabled={pendiente}
                    inputMode="decimal"
                    placeholder="0,00"
                    className="campo w-24 py-1 text-right"
                  />
                  <span className={`w-24 text-right tabular-nums ${cambio !== null && cambio < 0 ? "text-red-600" : ""}`}>
                    {cambio === null
                      ? ""
                      : cambio < 0
                        ? t("faltan {importe}", { importe: eur.format(-cambio) })
                        : t("cambio {importe}", { importe: eur.format(cambio) })}
                  </span>
                </div>
                {total > 0 && (
                  <div className="flex gap-1.5" role="group" aria-label={t("Importe entregado")}>
                    {entregasRapidas(total).map((importe, i) => (
                      <button
                        key={importe}
                        type="button"
                        onClick={() => setEntregado(aTexto(importe))}
                        disabled={pendiente}
                        className={`flex-1 rounded-md border py-1.5 text-sm font-medium tabular-nums transition disabled:cursor-not-allowed disabled:opacity-45 ${
                          aNumero(entregado) === importe ? "border-marca-500 bg-marca-50 text-marca-700" : "border-zinc-300 bg-superficie text-zinc-700 hover:bg-zinc-100"
                        }`}
                      >
                        {i === 0 ? t("Justo") : `${importe} €`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <input
                type="checkbox"
                checked={mayorEdad}
                onChange={(e) => setMayorEdad(e.target.checked)}
                disabled={pendiente}
                className="mt-0.5 h-4 w-4 disabled:cursor-not-allowed"
              />
              {t("He comprobado que el cliente es mayor de edad")}
            </label>

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button type="button" onClick={cobrar} disabled={pendiente || lineas.length === 0} className="btn w-full py-3 text-base">
              {pendiente ? t("Registrando…") : t("Cobrar {importe}", { importe: eur.format(total) })}
            </button>
          </div>
        </div>
      </aside>

      {lineas.length > 0 && !ticketVisible && !escaneando && (
        <button
          type="button"
          onClick={() => ticketRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="fixed inset-x-4 bottom-20 z-10 flex items-center justify-between rounded-full bg-zinc-900 px-5 py-3 text-zinc-50 shadow-lg lg:hidden"
        >
          <span className="text-sm">{t("{n} uds. en el ticket", { n: unidades })}</span>
          <span className="font-semibold tabular-nums">{eur.format(total)} →</span>
        </button>
      )}

      {escaneando && <Escaner continuo alDetectar={leerCodigo} alCerrar={() => setEscaneando(false)} />}
    </div>
  );
}
