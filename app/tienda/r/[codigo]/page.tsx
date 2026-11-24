import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelarReserva } from "@/components/cancelar-reserva";
import { nombreModelo } from "@/components/buscador";
import { leerAjustes, telefonoWhatsApp } from "@/lib/ajustes";
import { tx } from "@/lib/i18n";
import { traductor } from "@/lib/i18n/servidor";
import { basePublica } from "@/lib/origen";
import { codigoVisible, mensajeWhatsApp, reservaPorCodigo, tiempoRestante } from "@/lib/reservas";
import { cuando, euros } from "@/lib/format";

export async function generateMetadata() {
  const t = await traductor();
  return { title: t("Tu reserva") };
}

const AVISO = {
  pendiente: { clase: "border-amber-200 bg-amber-50 text-amber-900", titulo: tx("Pendiente de confirmar") },
  confirmada: { clase: "border-emerald-200 bg-emerald-50 text-emerald-900", titulo: tx("Reserva confirmada") },
  caducada: { clase: "border-zinc-200 bg-zinc-100 text-zinc-700", titulo: tx("La reserva ha caducado") },
  vendida: { clase: "border-emerald-200 bg-emerald-50 text-emerald-900", titulo: tx("¡Reserva completada!") },
  rechazada: { clase: "border-zinc-200 bg-zinc-100 text-zinc-700", titulo: tx("Reserva no confirmada") },
  cancelada: { clase: "border-zinc-200 bg-zinc-100 text-zinc-700", titulo: tx("Reserva cancelada") },
} as const;

export default async function Reserva({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const [r, a, base, t] = await Promise.all([reservaPorCodigo(codigo), leerAjustes(), basePublica(), traductor()]);
  if (!r) notFound();
  const activa = r.estado === "pendiente" || r.estado === "confirmada";
  const telefono = telefonoWhatsApp(a.whatsapp);
  const whatsapp = telefono ? `https://wa.me/${telefono}?text=${encodeURIComponent(mensajeWhatsApp(r, t))}` : null;
  const aviso = AVISO[r.estado];

  return (
    <div className="mx-auto max-w-md">
      <p className="text-sm text-zinc-500">{t("Tu código de reserva")}</p>
      <h1 className="mt-1 font-mono text-3xl font-semibold tracking-wider">{codigoVisible(r.codigo)}</h1>

      <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${aviso.clase}`}>
        <p className="font-semibold">{t(aviso.titulo)}</p>
        <p className="mt-0.5">
          {r.estado === "pendiente" &&
            t("Envíanos el código por WhatsApp para confirmarla. Te guardamos los productos hasta {cuando} ({quedan}).", {
              cuando: cuando(r.caducaEn, t),
              quedan: tiempoRestante(r.caducaEn, t),
            })}
          {r.estado === "confirmada" &&
            t("Te la guardamos hasta {cuando}. Seguimos por WhatsApp para cerrar la venta.", { cuando: cuando(r.caducaEn, t) })}
          {r.estado === "caducada" && t("Pasó el tiempo y los productos ya no están apartados. Puedes hacer otra reserva.")}
          {r.estado === "vendida" && t("Gracias por tu compra.")}
          {r.estado === "rechazada" && t("No hemos podido confirmar esta reserva. Escríbenos si tienes dudas.")}
          {r.estado === "cancelada" && t("Esta reserva se ha cancelado.")}
        </p>
      </div>

      {activa && whatsapp && (
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn btn-ok mt-4 w-full py-3 text-base">
          {t("Enviar por WhatsApp")}
        </a>
      )}
      {activa && !whatsapp && (
        <p className="mt-4 rounded-lg bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          {t("Escríbenos por WhatsApp o pásate por la tienda con tu código {codigo}.", { codigo: codigoVisible(r.codigo) })}
        </p>
      )}

      <div className="tarjeta mt-5 overflow-hidden">
        <div className="border-b border-zinc-200 px-4 py-2.5 text-sm">
          {t("A nombre de")} <strong>{r.nombre}</strong>
        </div>
        <ul className="divide-y divide-zinc-100 text-sm">
          {r.lineas.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="min-w-0">
                <span className="font-medium">
                  {l.cantidad} × {l.sabor}
                </span>
                <span className="block truncate text-xs text-zinc-500">
                  {nombreModelo(l)} · {l.nicotinaMg} mg
                </span>
              </span>
              <span className="shrink-0 tabular-nums">{euros(l.cantidad * Number(l.precioUnidad))}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-zinc-200 bg-zinc-50 px-4 py-2.5 font-semibold">
          <span>{t("Total")}</span>
          <span className="tabular-nums">{euros(r.total)}</span>
        </div>
      </div>

      {a.info && <p className="mt-4 whitespace-pre-line text-sm text-zinc-600">{a.info}</p>}

      {activa && (
        <div className="mt-6">
          <CancelarReserva codigo={r.codigo} />
        </div>
      )}

      <p className="mt-6 text-center text-xs text-zinc-500">
        {t("Guarda esta página para ver cómo va tu reserva.")} ·{" "}
        <Link href={base || "/"} className="enlace">
          {t("Volver al catálogo")}
        </Link>
      </p>
    </div>
  );
}
