import Link from "next/link";
import { Cabecera, Insignia, Vacio } from "@/components/ui";
import { FormAccion, BotonEnviar } from "@/components/form-accion";
import { confirmarReserva, rechazarPendientes } from "@/lib/actions/reservas";
import { leerAjustes } from "@/lib/ajustes";
import type { T } from "@/lib/i18n";
import { traductor } from "@/lib/i18n/servidor";
import { codigoVisible, ETIQUETA_ESTADO, listarReservas, resumenSinConfirmar, tiempoRestante, type ReservaFila } from "@/lib/reservas";
import { cuando, euros, fechaHora } from "@/lib/format";

export async function generateMetadata() {
  const t = await traductor();
  return { title: t("Reservas") };
}

const TONO = {
  pendiente: "ambar",
  confirmada: "verde",
  caducada: "gris",
  vendida: "marca",
  rechazada: "gris",
  cancelada: "gris",
} as const;

function Fila({ r, t }: { r: ReservaFila; t: T }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <Link href={`/reservas/${r.id}`} className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold">{codigoVisible(r.codigo)}</span>
          <span className="font-medium">{r.nombre}</span>
          <Insignia tono={TONO[r.estado]}>{t(ETIQUETA_ESTADO[r.estado])}</Insignia>
        </span>
        <span className="mt-0.5 block truncate text-sm text-zinc-600">{r.resumen}</span>
        <span className="block text-xs text-zinc-500">
          {r.estado === "pendiente" &&
            t("Caduca {cuando} · {quedan}", { cuando: cuando(r.caducaEn, t), quedan: tiempoRestante(r.caducaEn, t) })}
          {r.estado === "confirmada" &&
            t("Apartada hasta {cuando} · {quedan}", { cuando: cuando(r.caducaEn, t), quedan: tiempoRestante(r.caducaEn, t) })}
          {r.estado === "caducada" && t("Caducó {cuando}", { cuando: cuando(r.caducaEn, t) })}
          {(r.estado === "vendida" || r.estado === "rechazada" || r.estado === "cancelada") &&
            t("Hecha el {fecha}", { fecha: fechaHora(r.creadaEn) })}
        </span>
      </Link>
      <span className="text-right">
        <span className="block font-semibold tabular-nums">{euros(r.total)}</span>
        <span className="block text-xs text-zinc-500">{r.unidades === 1 ? t("1 ud.") : t("{n} uds.", { n: r.unidades })}</span>
      </span>
      {r.estado === "pendiente" && (
        <FormAccion accion={confirmarReserva}>
          <input type="hidden" name="id" value={r.id} />
          <BotonEnviar className="btn py-1.5 text-sm" textoPendiente="…">
            {t("Confirmar")}
          </BotonEnviar>
        </FormAccion>
      )}
      {r.estado === "confirmada" && (
        <Link href={`/ventas/nueva?reserva=${r.id}`} className="btn py-1.5 text-sm">
          {t("Vender")}
        </Link>
      )}
    </li>
  );
}

function Seccion({ titulo, lista, vacio, t }: { titulo: string; lista: ReservaFila[]; vacio?: string; t: T }) {
  if (lista.length === 0 && !vacio) return null;
  return (
    <section className="mb-6">
      <h2 className="mb-2 font-semibold">
        {titulo} <span className="font-normal text-zinc-400">({lista.length})</span>
      </h2>
      {lista.length === 0 ? (
        <Vacio>{vacio}</Vacio>
      ) : (
        <ul className="tarjeta divide-y divide-zinc-100 overflow-hidden">
          {lista.map((r) => (
            <Fila key={r.id} r={r} t={t} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function Reservas() {
  const [lista, a, t, sinConfirmar] = await Promise.all([listarReservas(), leerAjustes(), traductor(), resumenSinConfirmar()]);
  const de = (...estados: string[]) => lista.filter((r) => estados.includes(r.estado));
  const pendientes = de("pendiente");

  return (
    <>
      <Cabecera
        titulo={t("Reservas")}
        subtitulo={t("Las que hacen los clientes desde el catálogo. Lo reservado queda apartado y no se puede vender a otro.")}
        acciones={
          <>
            <Link href="/tienda" target="_blank" className="btn-sec">
              {t("Ver catálogo")}
            </Link>
            <Link href="/ajustes" className="btn-sec">
              {t("Ajustes")}
            </Link>
          </>
        }
      />

      {!a.catalogoAbierto && (
        <p className="mb-5 rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          {t("El catálogo está cerrado: los clientes no pueden reservar. Ábrelo en")}{" "}
          <Link href="/ajustes" className="enlace">
            {t("Ajustes")}
          </Link>
          .
        </p>
      )}
      {a.catalogoAbierto && !a.whatsapp && (
        <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("Pon tu número de WhatsApp en")}{" "}
          <Link href="/ajustes" className="font-medium underline">
            {t("Ajustes")}
          </Link>{" "}
          {t("para que los clientes puedan enviarte la reserva.")}
        </p>
      )}

      <Seccion t={t} titulo={t("Por confirmar")} lista={pendientes} vacio={t("No hay reservas esperando a que las confirmes.")} />
      {/* Siempre montado: después de rechazarlas todas sigue viéndose cuántas se rechazaron */}
      <FormAccion accion={rechazarPendientes} className={sinConfirmar.n ? "tarjeta -mt-3 mb-6 p-4" : "-mt-3 mb-6 empty:hidden"}>
        {sinConfirmar.n > 0 && (
          <>
            {/* Solo hasta la última que se ve ahora: una que llegue mientras tanto no se rechaza sin mirarla */}
            <input type="hidden" name="hasta" value={sinConfirmar.hasta} />
            <h2 className="font-semibold">{t("Rechazar todas las pendientes")}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {t(
                "Para cuando alguien llena el catálogo de reservas falsas. Rechaza de una vez las que no has confirmado ({n}), también las caducadas, y libera sus unidades.",
                { n: sinConfirmar.n },
              )}
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" name="confirmar" className="h-4 w-4" /> {t("Sí, quiero rechazar todas las reservas por confirmar")}
            </label>
            <div className="mt-3">
              <BotonEnviar className="btn-peligro" textoPendiente={t("Rechazando…")}>
                {t("Rechazar todas las pendientes")}
              </BotonEnviar>
            </div>
          </>
        )}
      </FormAccion>
      <Seccion t={t} titulo={t("Confirmadas, apartadas")} lista={de("confirmada")} />
      <Seccion t={t} titulo={t("Caducadas sin cerrar")} lista={de("caducada")} />
      <Seccion t={t} titulo={t("Últimos 30 días")} lista={de("vendida", "rechazada", "cancelada")} />
    </>
  );
}
