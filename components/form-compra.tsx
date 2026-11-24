"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { crearCompra } from "@/lib/actions/stock";
import { filtrarVariantes, nombreModelo, porCodigo, type VarianteLigera } from "./buscador";
import { BotonCamara, Escaner, useCamaraDisponible } from "./escaner";
import { useT } from "./preferencias";

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

type Linea = { key: number; varianteId: number; cantidad: string; coste: string; lote: string };

function aNumero(s: string) {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export function FormCompra({
  variantes,
  proveedores,
  hoy,
  inicial,
  socios = [],
  yo,
}: {
  variantes: VarianteLigera[];
  proveedores: { id: number; nombre: string }[];
  hoy: string;
  // Para abrir la compra ya rellena (desde el pedido sugerido)
  inicial?: { proveedorId: number | null; lineas: { varianteId: number; cantidad: number }[] };
  // Socios que pueden pagarla de su bolsillo
  socios?: { id: number; nombre: string }[];
  yo: number;
}) {
  const router = useRouter();
  const t = useT();
  // Por defecto la paga quien la registra (si es socio); «comun» = con dinero de la tienda
  const [paga, setPaga] = useState(socios.some((s) => s.id === yo) ? String(yo) : socios.length ? String(socios[0].id) : "comun");
  const [proveedorId, setProveedorId] = useState(
    inicial?.proveedorId && proveedores.some((p) => p.id === inicial.proveedorId) ? String(inicial.proveedorId) : "",
  );
  const [proveedorNuevo, setProveedorNuevo] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [factura, setFactura] = useState("");
  const [envio, setEnvio] = useState("");
  const [notas, setNotas] = useState("");
  const [lineas, setLineas] = useState<Linea[]>(() => {
    const porVariante = new Map(variantes.map((v) => [v.id, v]));
    return (inicial?.lineas ?? []).flatMap((l, i) => {
      const v = porVariante.get(l.varianteId);
      if (!v) return [];
      return [{ key: i + 1, varianteId: v.id, cantidad: String(l.cantidad), coste: v.coste > 0 ? v.coste.toFixed(2) : "", lote: "" }];
    });
  });
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const [escaneando, setEscaneando] = useState(false);
  const camara = useCamaraDisponible();

  const porId = useMemo(() => new Map(variantes.map((v) => [v.id, v])), [variantes]);
  const resultados = useMemo(() => (q.trim() ? filtrarVariantes(variantes, q, 12) : []), [variantes, q]);

  const subtotal = lineas.reduce((s, l) => {
    const c = aNumero(l.cantidad);
    const p = aNumero(l.coste);
    return s + (Number.isFinite(c) && Number.isFinite(p) ? c * p : 0);
  }, 0);
  const gastos = Number.isFinite(aNumero(envio)) && envio ? aNumero(envio) : 0;
  const factor = subtotal > 0 ? gastos / subtotal : 0;
  const unidades = lineas.reduce((s, l) => s + (Number.isInteger(aNumero(l.cantidad)) ? aNumero(l.cantidad) : 0), 0);

  function anadir(v: VarianteLigera) {
    setLineas((ls) => [
      ...ls,
      { key: Date.now() + Math.random(), varianteId: v.id, cantidad: "1", coste: v.coste > 0 ? v.coste.toFixed(2) : "", lote: "" },
    ]);
    setQ("");
    setError(null);
  }

  // Con la cámara: si el producto ya está en la compra, suma una unidad a esa línea
  function leerCodigo(codigo: string) {
    const v = porCodigo(variantes, codigo);
    if (!v) return t("No está en el catálogo: {codigo}", { codigo });
    const existente = lineas.find((l) => l.varianteId === v.id);
    if (existente) {
      const n = (Number.isInteger(aNumero(existente.cantidad)) ? aNumero(existente.cantidad) : 0) + 1;
      editar(existente.key, "cantidad", String(n));
      return t("{sabor}: {n} uds.", { sabor: v.sabor, n });
    }
    anadir(v);
    return t("Añadido: {sabor} ({modelo})", { sabor: v.sabor, modelo: nombreModelo(v) });
  }

  function editar(key: number, campo: keyof Linea, valor: string) {
    setLineas((ls) => ls.map((l) => (l.key === key ? { ...l, [campo]: valor } : l)));
  }

  function onEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const exacto = porCodigo(variantes, q);
    if (exacto) return anadir(exacto);
    if (resultados.length === 1) anadir(resultados[0]);
  }

  function guardar() {
    setError(null);
    if (lineas.length === 0) return setError(t("Añade al menos un producto."));
    const datos = lineas.map((l) => ({
      varianteId: l.varianteId,
      cantidad: aNumero(l.cantidad),
      costeUnidad: aNumero(l.coste),
      lote: l.lote || null,
    }));
    if (datos.some((d) => !Number.isInteger(d.cantidad) || d.cantidad <= 0)) return setError(t("Revisa las cantidades (enteros mayores que 0)."));
    if (datos.some((d) => !Number.isFinite(d.costeUnidad) || d.costeUnidad < 0)) return setError(t("Pon el coste por unidad de cada línea."));
    startTransition(async () => {
      const r = await crearCompra({
        proveedorId: proveedorId ? Number(proveedorId) : null,
        proveedorNuevo: proveedorNuevo || null,
        fecha,
        numFactura: factura || null,
        gastosEnvio: gastos,
        notas: notas || null,
        lineas: datos,
        pagaId: paga === "comun" ? null : Number(paga),
      });
      if (r?.error) return setError(r.error);
      router.push(`/compras/${r!.id}?nueva=1`);
    });
  }

  return (
    <div className="space-y-6">
      <section className="tarjeta grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="etiqueta" htmlFor="proveedor">
            {t("Proveedor")}
          </label>
          <select id="proveedor" className="campo" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
            <option value="">{t("— Sin indicar —")}</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="etiqueta" htmlFor="proveedor_nuevo">
            {t("…o proveedor nuevo")}
          </label>
          <input id="proveedor_nuevo" className="campo" value={proveedorNuevo} onChange={(e) => setProveedorNuevo(e.target.value)} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="fecha">
            {t("Fecha")}
          </label>
          <input id="fecha" type="date" className="campo" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="factura">
            {t("Nº factura")} <span className="font-normal text-zinc-400">{t("(opcional)")}</span>
          </label>
          <input id="factura" className="campo" value={factura} onChange={(e) => setFactura(e.target.value)} />
        </div>
      </section>

      <section className="tarjeta overflow-visible">
        <div className="border-b border-zinc-200 p-4">
          <div className="relative flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onEnter}
              placeholder={t("Añadir producto: busca marca, sabor o escanea el código")}
              className="campo"
              aria-label={t("Buscar producto para añadir")}
            />
            {camara && <BotonCamara onClick={() => setEscaneando(true)} />}
            {resultados.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-80 overflow-auto rounded-lg border border-zinc-200 bg-superficie shadow-lg">
                {resultados.map((v) => (
                  <li key={v.id}>
                    <button type="button" onClick={() => anadir(v)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-marca-50">
                      <span>
                        <span className="font-medium">{v.sabor}</span>{" "}
                        <span className="text-sm text-zinc-500">
                          {v.marca} {v.modelo} · {v.nicotinaMg} mg
                        </span>
                      </span>
                      <span className="text-xs text-zinc-500">{t("stock {n}", { n: v.stock })}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            {t("¿No aparece?")}{" "}
            <Link href="/catalogo/productos/nuevo" target="_blank" className="enlace">
              {t("Créalo en el catálogo")}
            </Link>{" "}
            {t("(se abre en otra pestaña) y luego")}{" "}
            <button type="button" onClick={() => router.refresh()} className="enlace">
              {t("recarga la lista")}
            </button>
            . {t("No perderás lo que llevas.")}
          </p>
        </div>

        {lineas.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-400">{t("Todavía no has añadido productos")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>{t("Producto")}</th>
                  <th className="w-24">{t("Cantidad")}</th>
                  <th className="w-28">{t("Coste/ud. (€)")}</th>
                  <th className="w-32">{t("Lote")}</th>
                  <th className="w-28 text-right">{t("Importe")}</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l) => {
                  const v = porId.get(l.varianteId);
                  const c = aNumero(l.cantidad);
                  const p = aNumero(l.coste);
                  const importe = Number.isFinite(c) && Number.isFinite(p) ? c * p : 0;
                  return (
                    <tr key={l.key}>
                      <td>
                        <div className="font-medium">{v?.sabor ?? `#${l.varianteId}`}</div>
                        <div className="text-xs text-zinc-500">
                          {v?.marca} {v?.modelo} · {v?.nicotinaMg} mg
                          {factor > 0 && Number.isFinite(p) && <> · {t("coste real {importe}", { importe: eur.format(p * (1 + factor)) })}</>}
                        </div>
                      </td>
                      <td>
                        <input
                          value={l.cantidad}
                          onChange={(e) => editar(l.key, "cantidad", e.target.value)}
                          inputMode="numeric"
                          className="campo py-1"
                          aria-label={t("Cantidad")}
                        />
                      </td>
                      <td>
                        <input
                          value={l.coste}
                          onChange={(e) => editar(l.key, "coste", e.target.value)}
                          inputMode="decimal"
                          placeholder="0,00"
                          className="campo py-1"
                          aria-label={t("Coste por unidad")}
                        />
                      </td>
                      <td>
                        <input value={l.lote} onChange={(e) => editar(l.key, "lote", e.target.value)} className="campo py-1" aria-label={t("Lote")} />
                      </td>
                      <td className="text-right tabular-nums">{eur.format(importe)}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => setLineas((ls) => ls.filter((x) => x.key !== l.key))}
                          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-red-600"
                          aria-label={t("Quitar línea")}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid gap-4 rounded-b-xl border-t border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className="etiqueta" htmlFor="envio">
                {t("Gastos de envío (€)")}
              </label>
              <input id="envio" value={envio} onChange={(e) => setEnvio(e.target.value)} inputMode="decimal" placeholder="0,00" className="campo sm:w-40" />
              <p className="mt-1 text-xs text-zinc-500">{t("Se reparten entre los productos para que el coste y el margen sean reales.")}</p>
            </div>
            <div>
              <label className="etiqueta" htmlFor="notas">
                {t("Notas")}
              </label>
              <input id="notas" value={notas} onChange={(e) => setNotas(e.target.value)} className="campo" />
            </div>
            {socios.length > 0 && (
              <div>
                <label className="etiqueta" htmlFor="paga">
                  {t("¿Quién la paga?")}
                </label>
                <select id="paga" value={paga} onChange={(e) => setPaga(e.target.value)} className="campo sm:w-72">
                  {socios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {t("{nombre}, de su bolsillo", { nombre: s.nombre })}
                    </option>
                  ))}
                  <option value="comun">{t("Dinero de la tienda (caja o cuenta común)")}</option>
                </select>
                <p className="mt-1 text-xs text-zinc-500">{t("Cuenta en las cuentas entre socios.")}</p>
              </div>
            )}
          </div>
          <div className="flex flex-col justify-end gap-1 text-sm sm:items-end">
            <div className="flex w-full justify-between sm:w-64">
              <span className="text-zinc-500">{t("Productos ({n} uds.)", { n: unidades })}</span>
              <span className="tabular-nums">{eur.format(subtotal)}</span>
            </div>
            <div className="flex w-full justify-between sm:w-64">
              <span className="text-zinc-500">{t("Envío")}</span>
              <span className="tabular-nums">{eur.format(gastos)}</span>
            </div>
            <div className="flex w-full justify-between text-lg font-semibold sm:w-64">
              <span>{t("Total")}</span>
              <span className="tabular-nums">{eur.format(subtotal + gastos)}</span>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={guardar} disabled={pendiente} className="btn">
          {pendiente ? t("Guardando…") : t("Guardar compra y meter en stock")}
        </button>
        <Link href="/compras" className="btn-sec">
          {t("Cancelar")}
        </Link>
      </div>
      {escaneando && <Escaner continuo alDetectar={leerCodigo} alCerrar={() => setEscaneando(false)} />}
    </div>
  );
}
