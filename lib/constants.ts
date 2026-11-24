import { tx } from "@/lib/i18n";

// Las etiquetas están en castellano: se traducen al pintarlas con t(etiqueta).
export const TZ = process.env.APP_TZ || "Europe/Madrid";

export const CATEGORIAS_SABOR = [
  { value: "tabaco", label: tx("Tabaco") },
  { value: "fruta", label: tx("Fruta") },
  { value: "menta", label: tx("Menta / frío") },
  { value: "postre", label: tx("Postre / dulce") },
  { value: "bebida", label: tx("Bebida") },
  { value: "otro", label: tx("Otro") },
] as const;

export const TIPOS_PRODUCTO = [
  { value: "desechable", label: tx("Desechable") },
  { value: "pod", label: tx("Pod / recargable") },
  { value: "liquido", label: tx("Líquido") },
  { value: "recambio", label: tx("Recambio / cartucho") },
  { value: "kit", label: tx("Kit") },
  { value: "otro", label: tx("Otro") },
] as const;

export const METODOS_PAGO = [
  { value: "efectivo", label: tx("Efectivo") },
  { value: "tarjeta", label: tx("Tarjeta") },
  { value: "bizum", label: tx("Bizum") },
] as const;

export const MOTIVOS_AJUSTE = [
  { value: "recuento", label: tx("Recuento (corregir stock)") },
  { value: "defectuoso", label: tx("Defectuoso / roto") },
  { value: "regalo", label: tx("Regalo / promoción") },
  { value: "consumo_propio", label: tx("Consumo propio") },
  { value: "devolucion_cliente", label: tx("Devolución de cliente") },
  { value: "otro", label: tx("Otro") },
] as const;

export const TIPOS_MOVIMIENTO: Record<string, string> = {
  compra: tx("Compra"),
  venta: tx("Venta"),
  ajuste: tx("Ajuste"),
  anulacion_compra: tx("Compra anulada"),
  anulacion_venta: tx("Venta anulada"),
  devolucion: tx("Devolución de cliente"),
};

export function etiqueta(lista: readonly { value: string; label: string }[], value: string | null | undefined) {
  return lista.find((x) => x.value === value)?.label ?? value ?? "";
}

export function valores(lista: readonly { value: string }[]) {
  return lista.map((x) => x.value) as string[];
}
