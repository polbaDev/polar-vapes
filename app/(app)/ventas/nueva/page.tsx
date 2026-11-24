import { Tpv } from "@/components/tpv";
import { variantesLigeras } from "@/lib/ligeras";
import { codigoVisible, detalleReserva } from "@/lib/reservas";
import { exigirSesion } from "@/lib/session";
import { tarjetaRecibe } from "@/lib/socios";
import { listarSocios } from "@/lib/usuarios";
import { traductor } from "@/lib/i18n/servidor";

export async function generateMetadata() {
  const t = await traductor();
  return { title: t("Vender") };
}

// ?reserva=12 → el TPV se abre con esa reserva cargada para cobrarla
export default async function NuevaVenta({ searchParams }: { searchParams: Promise<{ reserva?: string }> }) {
  const id = Number((await searchParams).reserva) || null;
  const [yo, r, socios, tarjeta] = await Promise.all([
    exigirSesion(),
    id ? detalleReserva(id) : null,
    listarSocios(),
    tarjetaRecibe(),
  ]);
  const abierta = r && (r.estado === "pendiente" || r.estado === "confirmada" || r.estado === "caducada");
  const variantes = await variantesLigeras(abierta ? r.id : null);
  return (
    <Tpv
      variantes={variantes}
      socios={socios}
      yo={yo.id}
      tarjetaA={socios.find((s) => s.id === tarjeta)?.nombre ?? null}
      reserva={
        abierta
          ? {
              id: r.id,
              codigo: codigoVisible(r.codigo),
              nombre: r.nombre,
              lineas: r.lineas.map((l) => ({ varianteId: l.varianteId, cantidad: l.cantidad })),
            }
          : null
      }
    />
  );
}
