"use client";

import { useState } from "react";
import { FormAccion, BotonEnviar } from "./form-accion";
import { useT } from "./preferencias";
import { apuntarMovimientoSocio } from "@/lib/actions/socios";
import { tx } from "@/lib/i18n";

type Tipo = "aportacion" | "pago" | "gasto" | "reparto" | "ajuste";

const TIPOS: { value: Tipo; label: string; ayuda: string }[] = [
  {
    value: "aportacion",
    label: tx("Aportación al bote"),
    ayuda: tx("Un socio pone dinero suyo para comprar más stock (ej. 105 € cada uno). Lo puede guardar él mismo o pasárselo al otro."),
  },
  { value: "pago", label: tx("Pago entre socios"), ayuda: tx("Uno le pasa dinero al otro (por ejemplo, para quedar a la par).") },
  { value: "gasto", label: tx("Gasto"), ayuda: tx("Algo de la tienda que no es stock y que un socio pagó de su bolsillo: bolsas, alquiler, publicidad…") },
  {
    value: "reparto",
    label: tx("Reparto de ganancias"),
    ayuda: tx("Cada socio se queda la misma cantidad de dinero de la tienda como ganancia. Se apunta lo mismo a cada uno."),
  },
  {
    value: "ajuste",
    label: tx("Saldo de partida"),
    ayuda: tx("Lo de antes de usar la app: el dinero de la tienda que alguien tiene guardado (ej. lo que queda de las últimas ventas) o el stock que alguien pagó de su bolsillo."),
  },
];

// Formulario para apuntar movimientos entre socios: los campos cambian según el tipo
export function FormMovimientoSocio({ socios, yo }: { socios: { id: number; nombre: string }[]; yo: number }) {
  const t = useT();
  const [tipo, setTipo] = useState<Tipo>("aportacion");
  const primero = socios.some((s) => s.id === yo) ? yo : socios[0]?.id;
  const otro = socios.find((s) => s.id !== primero)?.id;
  const elegir = (nombre: string, id: string, defecto: number | undefined, etiqueta: string) => (
    <div>
      <label className="etiqueta" htmlFor={id}>
        {etiqueta}
      </label>
      <select id={id} name={nombre} defaultValue={defecto} className="campo">
        {socios.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
          </option>
        ))}
      </select>
    </div>
  );
  const importe = (etiqueta: string) => (
    <div>
      <label className="etiqueta" htmlFor="importe_socio">
        {etiqueta}
      </label>
      <input id="importe_socio" name="importe" inputMode="decimal" placeholder="0,00" required className="campo text-right tabular-nums" />
    </div>
  );
  const motivo = (obligatorio: boolean, placeholder: string) => (
    <div className="sm:col-span-2">
      <label className="etiqueta" htmlFor="motivo_socio">
        {obligatorio ? t("Concepto") : t("Nota")} {!obligatorio && <span className="font-normal text-zinc-400">{t("(opcional)")}</span>}
      </label>
      <input id="motivo_socio" name="motivo" required={obligatorio} maxLength={200} placeholder={placeholder} className="campo" />
    </div>
  );

  return (
    <FormAccion accion={apuntarMovimientoSocio} limpiarAlGuardar className="tarjeta space-y-4 p-5">
      <input type="hidden" name="tipo" value={tipo} />
      <div className="segmento w-fit max-w-full overflow-x-auto [scrollbar-width:none]" role="radiogroup" aria-label={t("Qué quieres apuntar")}>
        {TIPOS.map((x) => (
          <button key={x.value} type="button" role="radio" aria-checked={tipo === x.value} onClick={() => setTipo(x.value)}>
            {t(x.label)}
          </button>
        ))}
      </div>
      <p className="text-sm text-zinc-500">{t(TIPOS.find((x) => x.value === tipo)!.ayuda)}</p>

      <div key={tipo} className="grid gap-4 sm:grid-cols-2">
        {tipo === "aportacion" && (
          <>
            {elegir("de", "de_socio", primero, t("Lo pone"))}
            {elegir("para", "para_socio", primero, t("Lo guarda"))}
            {importe(t("Importe (€)"))}
            {motivo(false, t("Ej. Para el pedido de diciembre"))}
          </>
        )}
        {tipo === "pago" && (
          <>
            {elegir("de", "de_socio", primero, t("Paga"))}
            {elegir("para", "para_socio", otro, t("A"))}
            {importe(t("Importe (€)"))}
            {motivo(false, t("Ej. Para quedar a la par"))}
          </>
        )}
        {tipo === "gasto" && (
          <>
            {elegir("de", "de_socio", primero, t("Lo pagó"))}
            {importe(t("Importe (€)"))}
            {motivo(true, t("Ej. Bolsas, alquiler de noviembre…"))}
          </>
        )}
        {tipo === "reparto" && (
          <>
            {importe(t("Para cada uno (€)"))}
            {motivo(false, t("Ej. Ganancias de noviembre"))}
          </>
        )}
        {tipo === "ajuste" && (
          <>
            {elegir("socio", "socio_ajuste", primero, t("Socio"))}
            {importe(t("Importe (€)"))}
            <fieldset className="sm:col-span-2">
              <legend className="etiqueta">{t("¿Qué pasó?")}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-superficie p-3 text-sm has-[:checked]:border-marca-500 has-[:checked]:bg-marca-50">
                  <input type="radio" name="sentido" value="puso" defaultChecked className="mt-0.5" />
                  <span>
                    <span className="block font-medium">{t("Puso dinero suyo")}</span>
                    <span className="text-zinc-500">{t("Pagó stock o cosas de la tienda de su bolsillo")}</span>
                  </span>
                </label>
                <label className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-superficie p-3 text-sm has-[:checked]:border-marca-500 has-[:checked]:bg-marca-50">
                  <input type="radio" name="sentido" value="tiene" className="mt-0.5" />
                  <span>
                    <span className="block font-medium">{t("Tiene dinero de la tienda")}</span>
                    <span className="text-zinc-500">{t("Tiene guardado dinero de ventas que es de los dos")}</span>
                  </span>
                </label>
              </div>
            </fieldset>
            {motivo(true, t("Ej. Lo que queda de las últimas ventas"))}
          </>
        )}
      </div>
      <BotonEnviar>{t("Apuntar")}</BotonEnviar>
    </FormAccion>
  );
}
