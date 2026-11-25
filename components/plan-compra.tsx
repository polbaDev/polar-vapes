"use client";

import { useState } from "react";
import { FormAccion, BotonEnviar } from "./form-accion";
import { useT } from "./preferencias";
import { apuntarMovimientoSocio } from "@/lib/actions/socios";
import { pagosParaCompra, type PagoSugerido } from "@/lib/socios-calculo";

export type SocioPlan = { id: number; nombre: string; saldo: number; tiene: number };

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", useGrouping: "always" });

function aNumero(texto: string) {
  const n = Number(texto.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

// Lo que recibe (+) o da (−) cada socio con unos pagos
function neto(pagos: PagoSugerido[], id: number) {
  return pagos.reduce((s, p) => s + (p.paraId === id ? p.importe : 0) - (p.deId === id ? p.importe : 0), 0);
}

// ¿Vais a comprar? Dice cuánto le pasa uno al otro para pagar la compra a medias
// (contando lo que ya tiene cada uno del bote) y cuánto le queda a cada uno después.
export function PlanCompra({ socios, yo }: { socios: SocioPlan[]; yo: number }) {
  const t = useT();
  const [importe, setImporte] = useState("");
  const [paga, setPaga] = useState(socios.some((s) => s.id === yo) ? yo : socios[0]?.id);
  const total = aNumero(importe);
  const pagos = total > 0 && paga != null ? pagosParaCompra(socios, paga, total) : [];
  const pagador = socios.find((s) => s.id === paga);
  // Lo que tendrá el que paga cuando le pasen el dinero, antes de pagar al proveedor
  const disponible = pagador ? pagador.tiene + neto(pagos, pagador.id) : 0;
  const falta = Math.round((total - disponible) * 100) / 100;

  return (
    <div className="tarjeta space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="etiqueta" htmlFor="plan_importe">
            {t("Importe de la compra (€)")}
          </label>
          <input
            id="plan_importe"
            value={importe}
            onChange={(e) => setImporte(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            className="campo text-right tabular-nums"
          />
        </div>
        <div>
          <span className="etiqueta">{t("Paga al proveedor")}</span>
          <div className="segmento w-fit" role="radiogroup" aria-label={t("Paga al proveedor")}>
            {socios.map((s) => (
              <button key={s.id} type="button" role="radio" aria-checked={paga === s.id} onClick={() => setPaga(s.id)} className="py-1.5">
                {s.nombre}
              </button>
            ))}
          </div>
        </div>
      </div>

      {total > 0 && pagador && (
        <div className="space-y-3 border-t border-zinc-200 pt-4">
          {pagos.length === 0 ? (
            <p className="text-lg font-medium">{t("No hace falta pasar nada: {nombre} la paga y seguís a medias.", { nombre: pagador.nombre })}</p>
          ) : (
            pagos.map((p) => (
              <FormAccion key={`${p.deId}-${p.paraId}`} accion={apuntarMovimientoSocio} className="flex flex-wrap items-center justify-between gap-3">
                <input type="hidden" name="tipo" value="pago" />
                <input type="hidden" name="de" value={p.deId} />
                <input type="hidden" name="para" value={p.paraId} />
                <input type="hidden" name="importe" value={p.importe.toFixed(2)} />
                <input type="hidden" name="motivo" value={t("Para la compra de {importe}", { importe: eur.format(total) })} />
                <p className="text-lg">
                  <strong>{p.de}</strong> {t("le pasa")} <strong className="tabular-nums">{eur.format(p.importe)}</strong> {t("a")}{" "}
                  <strong>{p.para}</strong>
                </p>
                <BotonEnviar className="btn-sec" textoPendiente={t("Apuntando…")}>
                  {t("Ya está pasado: apuntarlo")}
                </BotonEnviar>
              </FormAccion>
            ))
          )}
          {falta > 0.005 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t("Con eso a {nombre} le faltan {importe} para pagar: no hay bastante en el bote. Poned la diferencia a medias como aportación.", {
                nombre: pagador.nombre,
                importe: eur.format(falta),
              })}
            </p>
          ) : (
            <p className="text-sm text-zinc-600">
              {t("Después de pagarla, cada uno tendrá del bote:")}{" "}
              {socios
                .map((s) => `${s.nombre} ${eur.format(s.tiene + neto(pagos, s.id) - (s.id === pagador.id ? total : 0))}`)
                .join(" · ")}
            </p>
          )}
          <p className="text-xs text-zinc-500">
            {t("Cuando llegue el pedido, regístralo en Compras diciendo que la pagó {nombre}.", { nombre: pagador.nombre })}
          </p>
        </div>
      )}
    </div>
  );
}
