import { Tpv } from "@/components/tpv";
import { variantesLigeras } from "@/lib/ligeras";
import { codigoVisible, detalleReserva } from "@/lib/reservas";

export const metadata = { title: "Vender · Gestión Vapers" };

// ?reserva=12 → el TPV se abre con esa reserva cargada para cobrarla
export default async function NuevaVenta({ searchParams }: { searchParams: Promise<{ reserva?: string }> }) {
  const id = Number((await searchParams).reserva) || null;
  const r = id ? await detalleReserva(id) : null;
  const abierta = r && (r.estado === "pendiente" || r.estado === "confirmada" || r.estado === "caducada");
  const variantes = await variantesLigeras(abierta ? r.id : null);
  return (
    <Tpv
      variantes={variantes}
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
