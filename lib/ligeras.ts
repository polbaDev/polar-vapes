import "server-only";
import { listarVariantes, unidadesVendidas } from "@/lib/queries";
import type { VarianteLigera } from "@/components/buscador";

// Lista compacta de productos activos para las pantallas de venta y compra
export async function variantesLigeras(): Promise<VarianteLigera[]> {
  const [rows, vendidas] = await Promise.all([listarVariantes(), unidadesVendidas(30)]);
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
    codigo: v.codigoBarras,
    imagenId: v.imagenId,
    color: v.color,
    vendidas: vendidas.get(v.id) ?? 0,
  }));
}
