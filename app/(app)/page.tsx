import Link from "next/link";
import { Cabecera, Dato, InsigniaStock, Vacio } from "@/components/ui";
import { Foto } from "@/components/foto";
import { listarVariantes, resumenPeriodo, topSabores } from "@/lib/queries";
import { contarPendientes } from "@/lib/reservas";
import { euros, hoyISO } from "@/lib/format";
import { saldosSocios, ventasPorPersona } from "@/lib/socios";
import { pagosParaIgualar } from "@/lib/socios-calculo";
import { traductor } from "@/lib/i18n/servidor";

export default async function Inicio() {
  const t = await traductor();
  const [hoy, semana, mes, top, variantes, reservasPendientes, saldos, ventasHoy] = await Promise.all([
    resumenPeriodo(1),
    resumenPeriodo(7),
    resumenPeriodo(30),
    topSabores(30),
    listarVariantes(),
    contarPendientes(),
    saldosSocios(),
    ventasPorPersona(hoyISO(), hoyISO()),
  ]);
  const delReparto = saldos.filter((s) => s.socio);
  const pagos = pagosParaIgualar(delReparto);
  const bote = Math.round(saldos.reduce((suma, s) => suma + s.tiene, 0) * 100) / 100;
  const bajos = variantes
    .filter((v) => v.stock <= v.stockMinimo && (v.stockMinimo > 0 || v.stock <= 0))
    .sort((a, b) => a.stock - b.stock);
  const sinCatalogo = variantes.length === 0;
  const sinPrecio = variantes.filter((v) => Number(v.precioVenta) <= 0);
  const tickets = hoy.ventas === 1 ? t("1 ticket") : t("{n} tickets", { n: hoy.ventas });

  return (
    <>
      <Cabecera
        titulo={t("Inicio")}
        acciones={
          <>
            <Link href="/compras/nueva" className="btn-sec">
              {t("Registrar compra")}
            </Link>
            <Link href="/ventas/nueva" className="btn">
              {t("Nueva venta")}
            </Link>
          </>
        }
      />

      {sinCatalogo && (
        <div className="tarjeta mb-6 border-marca-200 bg-marca-50 p-5">
          <h2 className="font-semibold text-marca-900">{t("Para empezar")}</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-marca-900">
            <li>
              {t("Crea tus productos en")}{" "}
              <Link href="/catalogo/productos/nuevo" className="enlace">
                {t("Catálogo")} → {t("Nuevo producto")}
              </Link>{" "}
              {t("(marca y modelo) y añádeles sus sabores con el precio de venta.")}
            </li>
            <li>
              {t("Registra la")}{" "}
              <Link href="/compras/nueva" className="enlace">
                {t("compra")}
              </Link>{" "}
              {t("de lo que tienes: así entra el stock y se calcula tu coste.")}
            </li>
            <li>
              {t("Ya puedes")}{" "}
              <Link href="/ventas/nueva" className="enlace">
                {t("vender")}
              </Link>
              .
            </li>
          </ol>
        </div>
      )}

      {reservasPendientes > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>
            {reservasPendientes === 1
              ? t("Tienes 1 reserva por confirmar.")
              : t("Tienes {n} reservas por confirmar.", { n: reservasPendientes })}
          </span>
          <Link href="/reservas" className="font-medium underline">
            {t("Ver reservas")}
          </Link>
        </div>
      )}

      {sinPrecio.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>
            {sinPrecio.length === 1
              ? t("1 sabor no tiene precio de venta y no se puede vender todavía.")
              : t("{n} sabores no tienen precio de venta y no se pueden vender todavía.", { n: sinPrecio.length })}
          </span>
          <Link href={`/catalogo/productos/${sinPrecio[0].productoId}`} className="font-medium underline">
            {t("Poner precios")}
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato
          etiqueta={t("Ventas hoy")}
          valor={euros(hoy.total)}
          detalle={`${tickets} · ${t("{n} uds.", { n: hoy.unidades })}`}
        />
        <Dato etiqueta={t("Beneficio hoy")} valor={euros(hoy.beneficio)} detalle={t("Ventas menos coste")} />
        <Dato
          etiqueta={t("Últimos 7 días")}
          valor={euros(semana.total)}
          detalle={t("Beneficio {importe}", { importe: euros(semana.beneficio) })}
        />
        <Dato
          etiqueta={t("Últimos 30 días")}
          valor={euros(mes.total)}
          detalle={t("Beneficio {importe}", { importe: euros(mes.beneficio) })}
        />
      </div>

      <section className="tarjeta mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <h2 className="font-semibold">
            {t("Socios")}
            {saldos.length > 0 && (
              <span className="ml-2 font-normal text-zinc-500">
                · {t("Bote")} <span className="tabular-nums">{euros(bote)}</span>
              </span>
            )}
          </h2>
          <Link href="/socios" className="text-sm enlace">
            {t("Ver cuentas")}
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 text-sm">
          {delReparto.length < 2 ? (
            <span>
              {t("Para llevar las cuentas entre los dos, crea la cuenta de tu socio en")}{" "}
              <Link href="/socios/cuentas" className="enlace">
                {t("Cuentas y contraseñas")}
              </Link>
              .
            </span>
          ) : pagos.length === 0 ? (
            <span className="font-medium text-emerald-700">{t("Estáis a la par ✓")}</span>
          ) : (
            <span>
              {pagos.map((p, i) => (
                <span key={i} className="block">
                  {t("Para quedar a la par:")} <strong>{p.de}</strong> {t("paga")} <strong className="tabular-nums">{euros(p.importe)}</strong> {t("a")}{" "}
                  <strong>{p.para}</strong>
                </span>
              ))}
            </span>
          )}
          <span className="text-zinc-500">
            {ventasHoy.length === 0
              ? t("Hoy aún no hay ventas.")
              : `${t("Hoy:")} ${ventasHoy.map((v) => `${v.nombre ?? t("Sin asignar")} ${euros(v.vendido)}`).join(" · ")}`}
          </span>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="tarjeta overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
            <h2 className="font-semibold">{t("Reponer")}</h2>
            <span className="flex gap-4">
              <Link href="/inventario?bajo=1" className="text-sm enlace">
                {t("Ver todo")}
              </Link>
              <Link href="/compras/pedido" className="text-sm enlace">
                {t("Hacer pedido")}
              </Link>
            </span>
          </div>
          {bajos.length === 0 ? (
            <p className="px-4 py-6 text-sm text-zinc-500">{t("Nada por debajo del mínimo.")}</p>
          ) : (
            <table className="tabla">
              <tbody>
                {bajos.slice(0, 10).map((v) => (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/inventario/${v.id}`} className="flex items-center gap-3">
                        <Foto id={v.imagenId} color={v.color} alt="" texto={v.sabor} className="h-9 w-9 shrink-0 rounded-md" />
                        <span>
                          <span className="block font-medium">{v.sabor}</span>
                          <span className="block text-xs text-zinc-500">
                            {v.marca} {v.modelo} · {v.nicotinaMg} mg
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="text-right text-xs text-zinc-500">{t("mín. {n}", { n: v.stockMinimo })}</td>
                    <td className="w-12 text-right">
                      <InsigniaStock stock={v.stock} minimo={v.stockMinimo} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="tarjeta overflow-hidden">
          <div className="border-b border-zinc-200 px-4 py-3">
            <h2 className="font-semibold">{t("Sabores más vendidos · 30 días")}</h2>
          </div>
          {top.length === 0 ? (
            <div className="p-4">
              <Vacio>{t("Aún no hay ventas.")}</Vacio>
            </div>
          ) : (
            <table className="tabla">
              <tbody>
                {top.map((s, i) => (
                  <tr key={s.sabor}>
                    <td className="w-8 text-zinc-400 tabular-nums">{i + 1}</td>
                    <td className="font-medium">{s.sabor}</td>
                    <td className="text-right tabular-nums text-zinc-500">{t("{n} uds.", { n: s.unidades })}</td>
                    <td className="text-right tabular-nums">{euros(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
