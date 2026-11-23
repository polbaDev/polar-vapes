import "server-only";
import { listarVariantes } from "@/lib/queries";
import type { VarianteLigera } from "@/components/buscador";

// Lista compacta de productos activos para las pantallas de venta y compra
export async function variantesLigeras(): Promise<VarianteLigera[]> {
  const rows = await listarVariantes();
  return rows.map((v) => ({
    id: v.id,
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
  }));
}
