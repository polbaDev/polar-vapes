import Link from "next/link";
import { Cabecera, Insignia, Vacio } from "@/components/ui";
import { FormAccion, BotonEnviar } from "@/components/form-accion";
import { confirmarReserva } from "@/lib/actions/reservas";
import { leerAjustes } from "@/lib/ajustes";
import { codigoVisible, ETIQUETA_ESTADO, listarReservas, tiempoRestante, type ReservaFila } from "@/lib/reservas";
import { cuando, euros, fechaHora } from "@/lib/format";

export const metadata = { title: "Reservas · Gestión Vapers" };

const TONO = {
  pendiente: "ambar",
  confirmada: "verde",
  caducada: "gris",
  vendida: "marca",
  rechazada: "gris",
  cancelada: "gris",
} as const;

function Fila({ r }: { r: ReservaFila }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <Link href={`/reservas/${r.id}`} className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold">{codigoVisible(r.codigo)}</span>
          <span className="font-medium">{r.nombre}</span>
          <Insignia tono={TONO[r.estado]}>{ETIQUETA_ESTADO[r.estado]}</Insignia>
        </span>
        <span className="mt-0.5 block truncate text-sm text-zinc-600">{r.resumen}</span>
        <span className="block text-xs text-zinc-500">
          {r.estado === "pendiente" && `Caduca ${cuando(r.caducaEn)} · ${tiempoRestante(r.caducaEn)}`}
          {r.estado === "confirmada" && `Apartada hasta ${cuando(r.caducaEn)} · ${tiempoRestante(r.caducaEn)}`}
          {r.estado === "caducada" && `Caducó ${cuando(r.caducaEn)}`}
          {(r.estado === "vendida" || r.estado === "rechazada" || r.estado === "cancelada") && `Hecha el ${fechaHora(r.creadaEn)}`}
        </span>
      </Link>
      <span className="text-right">
        <span className="block font-semibold tabular-nums">{euros(r.total)}</span>
        <span className="block text-xs text-zinc-500">{r.unidades} uds.</span>
      </span>
      {r.estado === "pendiente" && (
        <FormAccion accion={confirmarReserva}>
          <input type="hidden" name="id" value={r.id} />
          <BotonEnviar className="btn py-1.5 text-sm" textoPendiente="…">
            Confirmar
          </BotonEnviar>
        </FormAccion>
      )}
      {r.estado === "confirmada" && (
        <Link href={`/ventas/nueva?reserva=${r.id}`} className="btn py-1.5 text-sm">
          Vender
        </Link>
      )}
    </li>
  );
}

function Seccion({ titulo, lista, vacio }: { titulo: string; lista: ReservaFila[]; vacio?: string }) {
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
            <Fila key={r.id} r={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function Reservas() {
  const [lista, a] = await Promise.all([listarReservas(), leerAjustes()]);
  const de = (...estados: string[]) => lista.filter((r) => estados.includes(r.estado));

  return (
    <>
      <Cabecera
        titulo="Reservas"
        subtitulo="Las que hacen los clientes desde el catálogo. Lo reservado queda apartado y no se puede vender a otro."
        acciones={
          <>
            <Link href="/tienda" target="_blank" className="btn-sec">
              Ver catálogo
            </Link>
            <Link href="/ajustes" className="btn-sec">
              Ajustes
            </Link>
          </>
        }
      />

      {!a.catalogoAbierto && (
        <p className="mb-5 rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          El catálogo está cerrado: los clientes no pueden reservar. Ábrelo en <Link href="/ajustes" className="enlace">Ajustes</Link>.
        </p>
      )}
      {a.catalogoAbierto && !a.whatsapp && (
        <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Pon tu número de WhatsApp en <Link href="/ajustes" className="font-medium underline">Ajustes</Link> para que los clientes puedan
          enviarte la reserva.
        </p>
      )}

      <Seccion titulo="Por confirmar" lista={de("pendiente")} vacio="No hay reservas esperando a que las confirmes." />
      <Seccion titulo="Confirmadas, apartadas" lista={de("confirmada")} />
      <Seccion titulo="Caducadas sin cerrar" lista={de("caducada")} />
      <Seccion titulo="Últimos 30 días" lista={de("vendida", "rechazada", "cancelada")} />
    </>
  );
}
