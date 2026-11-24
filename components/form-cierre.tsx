"use client";

import { useState } from "react";
import { FormAccion, BotonEnviar } from "./form-accion";
import { cerrarCaja } from "@/lib/actions/caja";
import { useT } from "@/components/preferencias";

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

// Valores en céntimos para sumar sin errores de redondeo
const BILLETES = [10000, 5000, 2000, 1000, 500];
const MONEDAS = [200, 100, 50, 20, 10, 5, 2, 1];

// «ct» y «cts» son iguales en catalán (cèntim, cèntims)
function nombre(c: number) {
  return c >= 100 ? `${c / 100} €` : c === 1 ? "1 ct" : `${c} cts`;
}

function aNumero(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function aTexto(n: number) {
  return n.toFixed(2).replace(".", ",");
}

export function FormCierre({
  ultimoId,
  fondoInicial,
  movimientoSinFondo,
}: {
  ultimoId: number | null;
  // null si es el primer cierre (hay que preguntarlo)
  fondoInicial: number | null;
  // ventas en efectivo - anuladas + entradas - salidas
  movimientoSinFondo: number;
}) {
  const t = useT();
  const [fondoIni, setFondoIni] = useState("");
  const [contado, setContado] = useState("");
  const [fondoSig, setFondoSig] = useState(fondoInicial !== null ? aTexto(fondoInicial) : "");
  const [contar, setContar] = useState(false);
  const [unidades, setUnidades] = useState<Record<number, string>>({});

  const fondo = fondoInicial ?? aNumero(fondoIni);
  const esperado = fondo === null ? null : Math.round((fondo + movimientoSinFondo) * 100) / 100;
  const contadoN = aNumero(contado);
  const descuadre = esperado !== null && contadoN !== null ? Math.round((contadoN - esperado) * 100) / 100 : null;
  const fondoSigN = aNumero(fondoSig);
  const teLlevas = contadoN !== null && fondoSigN !== null ? Math.round((contadoN - fondoSigN) * 100) / 100 : null;

  function cambiarUnidades(c: number, valor: string) {
    const nuevas = { ...unidades, [c]: valor.replace(/\D/g, "") };
    setUnidades(nuevas);
    const centimos = [...BILLETES, ...MONEDAS].reduce((s, d) => s + d * (Number(nuevas[d]) || 0), 0);
    setContado(aTexto(centimos / 100));
  }

  return (
    <FormAccion accion={cerrarCaja} className="tarjeta space-y-4 p-5">
      <input type="hidden" name="ultimo" value={ultimoId ?? 0} />
      <h2 className="font-semibold">{t("Cerrar caja")}</h2>

      {fondoInicial === null && (
        <div>
          <label className="etiqueta" htmlFor="fondo_inicial">
            {t("¿Con cuánto efectivo empezaste hoy?")}
          </label>
          <input
            id="fondo_inicial"
            name="fondo_inicial"
            value={fondoIni}
            onChange={(e) => setFondoIni(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            required
            className="campo text-right"
          />
          <p className="mt-1 text-xs text-zinc-500">
            {t("Solo te lo pregunto la primera vez. Luego se usa lo que dejes en caja al cerrar.")}
          </p>
        </div>
      )}

      <div>
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <label className="etiqueta mb-0" htmlFor="contado">
            {t("Efectivo contado en el cajón")}
          </label>
          <button type="button" onClick={() => setContar((v) => !v)} className="text-sm enlace">
            {contar ? t("Ocultar") : t("Contar billetes y monedas")}
          </button>
        </div>
        <input
          id="contado"
          name="contado"
          value={contado}
          onChange={(e) => setContado(e.target.value)}
          inputMode="decimal"
          placeholder="0,00"
          required
          className="campo py-3 text-right text-lg tabular-nums"
        />
      </div>

      {contar && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg bg-zinc-50 p-3 text-sm">
          {[...BILLETES, ...MONEDAS].map((c) => (
            <label key={c} className="flex items-center justify-between gap-2">
              <span className="w-14 shrink-0 text-zinc-600">{nombre(c)}</span>
              <span className="text-zinc-400">×</span>
              <input
                value={unidades[c] ?? ""}
                onChange={(e) => cambiarUnidades(c, e.target.value)}
                inputMode="numeric"
                placeholder="0"
                aria-label={t("Cantidad de {moneda}", { moneda: nombre(c) })}
                className="campo w-16 px-2 py-1 text-right tabular-nums"
              />
            </label>
          ))}
        </div>
      )}

      <dl className="space-y-1 rounded-lg border border-zinc-200 px-4 py-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-zinc-500">{t("Debería haber")}</dt>
          <dd className="tabular-nums">{esperado === null ? "—" : eur.format(esperado)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-500">{t("Has contado")}</dt>
          <dd className="tabular-nums">{contadoN === null ? "—" : eur.format(contadoN)}</dd>
        </div>
        <div className="flex justify-between border-t border-zinc-100 pt-1 text-base font-semibold">
          <dt>{t("Resultado")}</dt>
          <dd
            className={`tabular-nums ${
              descuadre === null ? "text-zinc-400" : descuadre === 0 ? "text-emerald-700" : descuadre < 0 ? "text-red-600" : "text-amber-700"
            }`}
          >
            {descuadre === null
              ? "—"
              : descuadre === 0
                ? `${t("Cuadra")} ✓`
                : descuadre < 0
                  ? t("Faltan {importe}", { importe: eur.format(-descuadre) })
                  : t("Sobran {importe}", { importe: eur.format(descuadre) })}
          </dd>
        </div>
      </dl>

      <div>
        <label className="etiqueta" htmlFor="fondo_siguiente">
          {t("Dejas en caja para el próximo día")}
        </label>
        <input
          id="fondo_siguiente"
          name="fondo_siguiente"
          value={fondoSig}
          onChange={(e) => setFondoSig(e.target.value)}
          inputMode="decimal"
          placeholder="0,00"
          required
          className="campo text-right tabular-nums"
        />
        <p className={`mt-1 text-xs ${teLlevas !== null && teLlevas < 0 ? "text-red-600" : "text-zinc-500"}`}>
          {teLlevas === null
            ? t("El cambio para empezar. Lo demás te lo llevas.")
            : teLlevas < 0
              ? t("No puedes dejar más de lo que has contado.")
              : t("Te llevas {importe}", { importe: eur.format(teLlevas) })}
        </p>
      </div>

      <div>
        <label className="etiqueta" htmlFor="notas">
          {t("Notas")} <span className="font-normal text-zinc-400">{t("(opcional)")}</span>
        </label>
        <textarea
          id="notas"
          name="notas"
          rows={2}
          placeholder={descuadre ? t("¿Sabes por qué no cuadra? Apúntalo aquí.") : ""}
          className="campo"
        />
      </div>

      <BotonEnviar className="btn w-full py-3 text-base" textoPendiente={t("Cerrando…")}>
        {t("Cerrar caja")}
      </BotonEnviar>
      <p className="text-center text-xs text-zinc-500">
        {t("Las ventas que hagas después de cerrar irán al siguiente cierre. Si te equivocas, puedes reabrir el último cierre.")}
      </p>
    </FormAccion>
  );
}
