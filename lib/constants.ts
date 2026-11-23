export const TZ = process.env.APP_TZ || "Europe/Madrid";

export const CATEGORIAS_SABOR = [
  { value: "tabaco", label: "Tabaco" },
  { value: "fruta", label: "Fruta" },
  { value: "menta", label: "Menta / frío" },
  { value: "postre", label: "Postre / dulce" },
  { value: "bebida", label: "Bebida" },
  { value: "otro", label: "Otro" },
] as const;

export const TIPOS_PRODUCTO = [
  { value: "desechable", label: "Desechable" },
  { value: "pod", label: "Pod / recargable" },
  { value: "liquido", label: "Líquido" },
  { value: "recambio", label: "Recambio / cartucho" },
  { value: "kit", label: "Kit" },
  { value: "otro", label: "Otro" },
] as const;

export const METODOS_PAGO = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "bizum", label: "Bizum" },
] as const;

export const MOTIVOS_AJUSTE = [
  { value: "recuento", label: "Recuento (corregir stock)" },
  { value: "defectuoso", label: "Defectuoso / roto" },
  { value: "regalo", label: "Regalo / promoción" },
  { value: "consumo_propio", label: "Consumo propio" },
  { value: "devolucion_cliente", label: "Devolución de cliente" },
  { value: "otro", label: "Otro" },
] as const;

export const TIPOS_MOVIMIENTO: Record<string, string> = {
  compra: "Compra",
  venta: "Venta",
  ajuste: "Ajuste",
  anulacion_compra: "Compra anulada",
  anulacion_venta: "Venta anulada",
  devolucion: "Devolución de cliente",
};

export function etiqueta(lista: readonly { value: string; label: string }[], value: string | null | undefined) {
  return lista.find((x) => x.value === value)?.label ?? value ?? "";
}

export function valores(lista: readonly { value: string }[]) {
  return lista.map((x) => x.value) as string[];
}
