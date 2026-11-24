import Link from "next/link";
import { Cabecera, Dato, Insignia, Vacio } from "@/components/ui";
import { listarVentas } from "@/lib/queries";
import { listarUsuarios } from "@/lib/usuarios";
import { euros, fechaHora, hoyISO } from "@/lib/format";
import { METODOS_PAGO, etiqueta } from "@/lib/constants";
import { tx } from "@/lib/i18n";
import { traductor } from "@/lib/i18n/servidor";

function restarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

const PERIODOS = [
  { id: "hoy", texto: tx("Hoy") },
  { id: "7", texto: tx("7 días") },
  { id: "30", texto: tx("30 días") },
  { id: "mes", texto: tx("Este mes") },
];

export default async function Ventas({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; desde?: string; hasta?: string; u?: string }>;
}) {
  const t = await traductor();
  const sp = await searchParams;
  const hoy = hoyISO();
  const esFecha = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  let desde = hoy;
  let hasta = hoy;
  let periodo = sp.p ?? "hoy";
  if (esFecha(sp.desde) || esFecha(sp.hasta)) {
    periodo = "rango";
    desde = esFecha(sp.desde) ? sp.desde! : hoy;
    hasta = esFecha(sp.hasta) ? sp.hasta! : hoy;
  } else if (periodo === "7") desde = restarDias(hoy, 6);
  else if (periodo === "30") desde = restarDias(hoy, 29);
  else if (periodo === "mes") desde = `${hoy.slice(0, 7)}-01`;

  // ?u=3 → solo las de esa persona (u=0: las de antes de las cuentas)
  const persona = sp.u !== undefined && /^\d{1,9}$/.test(sp.u) ? Number(sp.u) : undefined;
  const [ventas, personas] = await Promise.all([listarVentas(desde, hasta, true, persona), listarUsuarios()]);
  const validas = ventas.filter((v) => !v.anulada);
  // Enlaces que conservan el periodo y cambian la persona (o al revés)
  const filtroPeriodo = periodo === "rango" ? `desde=${desde}&hasta=${hasta}` : `p=${periodo}`;
  const conPersona = (u: number | undefined) => `/ventas?${filtroPeriodo}${u === undefined ? "" : `&u=${u}`}`;
  // Lo que queda cobrado de cada venta, descontando devoluciones parciales
  const neto = (v: (typeof ventas)[number]) => Number(v.total) - Number(v.devuelto);
  const total = validas.reduce((s, v) => s + neto(v), 0);
  const beneficio = validas.reduce((s, v) => s + neto(v) - Number(v.coste), 0);
  const unidades = validas.reduce((s, v) => s + v.unidades, 0);
  const porPago = METODOS_PAGO.map((m) => ({
    ...m,
    total: validas.filter((v) => v.metodoPago === m.value).reduce((s, v) => s + neto(v), 0),
  }));

  return (
    <>
      <Cabecera
        titulo={t("Ventas")}
        acciones={
          <Link href="/ventas/nueva" className="btn">
            {t("Nueva venta")}
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-2">
        {PERIODOS.map((p) => (
          <Link
            key={p.id}
            href={`/ventas?p=${p.id}${persona === undefined ? "" : `&u=${persona}`}`}
            aria-current={periodo === p.id ? "true" : undefined}
            className="chip"
          >
            {t(p.texto)}
          </Link>
        ))}
        <form className="flex items-end gap-2" action="/ventas">
          <input type="date" name="desde" defaultValue={desde} className="campo py-1.5 text-sm" aria-label={t("Desde")} />
          <input type="date" name="hasta" defaultValue={hasta} className="campo py-1.5 text-sm" aria-label={t("Hasta")} />
          {persona !== undefined && <input type="hidden" name="u" value={persona} />}
          <button className="btn-sec py-1.5 text-sm">{t("Ver")}</button>
        </form>
      </div>

      {personas.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label={t("Filtrar por persona")}>
          <Link href={conPersona(undefined)} aria-current={persona === undefined ? "true" : undefined} className="chip">
            {t("Todos")}
          </Link>
          {personas.map((u) => (
            <Link key={u.id} href={conPersona(u.id)} aria-current={persona === u.id ? "true" : undefined} className="chip">
              {u.nombre}
            </Link>
          ))}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato
          etiqueta={t("Vendido")}
          valor={euros(total)}
          detalle={validas.length === 1 ? t("1 ticket") : t("{n} tickets", { n: validas.length })}
        />
        <Dato
          etiqueta={t("Beneficio")}
          valor={euros(beneficio)}
          detalle={total > 0 ? t("{porcentaje} % de margen", { porcentaje: ((beneficio / total) * 100).toFixed(0) }) : undefined}
        />
        <Dato etiqueta={t("Unidades")} valor={unidades} />
        <Dato
          etiqueta={t("Por forma de pago")}
          valor={<span className="text-base font-medium">{porPago.map((p) => `${t(p.label)} ${euros(p.total)}`).join(" · ")}</span>}
        />
      </div>

      {ventas.length === 0 ? (
        <Vacio>{t("No hay ventas en este periodo.")}</Vacio>
      ) : (
        <div className="tarjeta overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>{t("Fecha")}</th>
                <th>{t("Pago")}</th>
                <th>{t("Cobró")}</th>
                <th className="text-right">{t("Uds.")}</th>
                <th className="text-right">{t("Total")}</th>
                <th className="text-right">{t("Beneficio")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id} className={v.anulada ? "text-zinc-400 line-through" : ""}>
                  <td className="whitespace-nowrap">{fechaHora(v.fecha)}</td>
                  <td>
                    {t(etiqueta(METODOS_PAGO, v.metodoPago))}
                    {v.recibe && <div className="text-xs text-zinc-500">{t("a {nombre}", { nombre: v.recibe })}</div>}
                  </td>
                  <td>{v.vendedor ?? <span className="text-zinc-400">—</span>}</td>
                  <td className="text-right tabular-nums">{v.unidades}</td>
                  <td className="text-right font-medium tabular-nums">
                    {euros(v.anulada ? v.total : neto(v))}
                    {Number(v.devuelto) > 0 && !v.anulada && (
                      <div className="text-xs font-normal text-zinc-500">{t("de {importe}", { importe: euros(v.total) })}</div>
                    )}
                  </td>
                  <td className="text-right tabular-nums">{v.anulada ? "" : euros(neto(v) - Number(v.coste))}</td>
                  <td className="text-right no-underline">
                    {v.anulada && <Insignia tono="rojo">{t("Anulada")}</Insignia>}
                    {Number(v.devuelto) > 0 && !v.anulada && <Insignia tono="ambar">{t("Devolución")}</Insignia>}{" "}
                    <Link href={`/ventas/${v.id}`} className="enlace text-sm">
                      {t("Ver")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
