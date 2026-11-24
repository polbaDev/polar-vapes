// Coste medio al anular una compra. Sin base de datos, para poder probarlo aparte.

export type LineaCompraCoste = { cantidad: number; costeReal: number };

// Margen para los redondeos (el coste medio se guarda con 4 decimales)
const MARGEN = 0.0001;

// stock y coste: los de ahora, antes de anular. cantidad y costeReal: los de la línea que se anula.
// otras: el resto de líneas de compra no anuladas de esa variante, la más reciente primero.
// conAjustes: si entraron unidades por ajustes, que valen el coste de aquel momento (0 si aún no había compras).
export function costeTrasAnularCompra(
  stock: number,
  coste: number,
  cantidad: number,
  costeReal: number,
  otras: LineaCompraCoste[],
  conAjustes = false,
) {
  const restante = stock - cantidad;
  if (restante <= 0) return coste;
  // Lo contrario de la media ponderada al comprar
  const cuenta = (stock * coste - cantidad * costeReal) / restante;
  if (otras.length === 0) return Number.isFinite(cuenta) && cuenta >= 0 ? cuenta : coste;
  // Si parte de lo comprado ya se vendió y luego entraron otras compras, la cuenta se dispara (o da negativo).
  // Solo vale si queda entre el coste más bajo y el más alto de las otras compras (desde 0 si hay ajustes).
  const costes = otras.map((o) => o.costeReal);
  const minimo = conAjustes ? 0 : Math.min(...costes) - MARGEN;
  if (Number.isFinite(cuenta) && cuenta >= minimo && cuenta <= Math.max(...costes) + MARGEN) return cuenta;
  // Si no, lo que quede se valora al coste de las compras más recientes que cubren esas unidades
  let unidades = 0;
  let importe = 0;
  for (const o of otras) {
    const n = Math.min(o.cantidad, restante - unidades);
    if (n <= 0) break;
    unidades += n;
    importe += n * o.costeReal;
  }
  return unidades > 0 ? importe / unidades : coste;
}
