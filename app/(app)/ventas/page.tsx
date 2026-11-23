import Link from "next/link";
import { Cabecera, Dato, Insignia, Vacio } from "@/components/ui";
import { listarVentas } from "@/lib/queries";
import { euros, fechaHora, hoyISO } from "@/lib/format";
import { METODOS_PAGO, etiqueta } from "@/lib/constants";

function restarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

const PERIODOS = [
  { id: "hoy", texto: "Hoy" },
  { id: "7", texto: "7 días" },
  { id: "30", texto: "30 días" },
  { id: "mes", texto: "Este mes" },
];

export default async function Ventas({ searchParams }: { searchParams: Promise<{ p?: string; desde?: string; hasta?: string }> }) {
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

  const ventas = await listarVentas(desde, hasta);
  const validas = ventas.filter((v) => !v.anulada);
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
        titulo="Ventas"
        acciones={
          <Link href="/ventas/nueva" className="btn">
            Nueva venta
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-2">
        {PERIODOS.map((p) => (
          <Link
            key={p.id}
            href={`/ventas?p=${p.id}`}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              periodo === p.id ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-100"
            }`}
          >
            {p.texto}
          </Link>
        ))}
        <form className="flex items-end gap-2" action="/ventas">
          <input type="date" name="desde" defaultValue={desde} className="campo py-1.5 text-sm" aria-label="Desde" />
          <input type="date" name="hasta" defaultValue={hasta} className="campo py-1.5 text-sm" aria-label="Hasta" />
          <button className="btn-sec py-1.5 text-sm">Ver</button>
        </form>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato etiqueta="Vendido" valor={euros(total)} detalle={`${validas.length} tickets`} />
        <Dato etiqueta="Beneficio" valor={euros(beneficio)} detalle={total > 0 ? `${((beneficio / total) * 100).toFixed(0)} % de margen` : undefined} />
        <Dato etiqueta="Unidades" valor={unidades} />
        <Dato etiqueta="Por forma de pago" valor={<span className="text-base font-medium">{porPago.map((p) => `${p.label} ${euros(p.total)}`).join(" · ")}</span>} />
      </div>

      {ventas.length === 0 ? (
        <Vacio>No hay ventas en este periodo.</Vacio>
      ) : (
        <div className="tarjeta overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Pago</th>
                <th className="text-right">Uds.</th>
                <th className="text-right">Total</th>
                <th className="text-right">Beneficio</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id} className={v.anulada ? "text-zinc-400 line-through" : ""}>
                  <td className="whitespace-nowrap">{fechaHora(v.fecha)}</td>
                  <td>{etiqueta(METODOS_PAGO, v.metodoPago)}</td>
                  <td className="text-right tabular-nums">{v.unidades}</td>
                  <td className="text-right font-medium tabular-nums">
                    {euros(v.anulada ? v.total : neto(v))}
                    {Number(v.devuelto) > 0 && !v.anulada && (
                      <div className="text-xs font-normal text-zinc-500">de {euros(v.total)}</div>
                    )}
                  </td>
                  <td className="text-right tabular-nums">{v.anulada ? "" : euros(neto(v) - Number(v.coste))}</td>
                  <td className="text-right no-underline">
                    {v.anulada && <Insignia tono="rojo">Anulada</Insignia>}
                    {Number(v.devuelto) > 0 && !v.anulada && <Insignia tono="ambar">Devolución</Insignia>}{" "}
                    <Link href={`/ventas/${v.id}`} className="enlace text-sm">
                      Ver
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
