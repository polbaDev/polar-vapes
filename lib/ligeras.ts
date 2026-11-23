import "server-only";
import { listarVariantes, unidadesVendidas } from "@/lib/queries";
import { unidadesReservadas } from "@/lib/reservas";
import type { VarianteLigera } from "@/components/buscador";

// Lista compacta de productos activos para las pantallas de venta y compra.
// excluirReserva: al cobrar una reserva, sus propias unidades no cuentan como apartadas.
export async function variantesLigeras(excluirReserva?: number | null): Promise<VarianteLigera[]> {
  const [rows, vendidas, reservadas] = await Promise.all([listarVariantes(), unidadesVendidas(30), unidadesReservadas(excluirReserva)]);
  return rows.map((v) => ({
    id: v.id,
    productoId: v.productoId,
    marca: v.marca,
    modelo: v.modelo,
    sabor: v.sabor,
    nicotinaMg: v.nicotinaMg,
    precio: Number(v.precioVenta),
    coste: Number(v.costeMedio),
    stock: v.stock,
    reservado: reservadas.get(v.id) ?? 0,
    codigo: v.codigoBarras,
    imagenId: v.imagenId,
    color: v.color,
    vendidas: vendidas.get(v.id) ?? 0,
  }));
}
