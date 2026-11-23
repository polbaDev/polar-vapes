// Dinero a devolver por cada línea. Lo usan la pantalla (para mostrarlo) y el servidor (para guardarlo).
//
// - Si el ticket tuvo descuento, se reparte: cada unidad devuelve su precio × (total / subtotal).
// - Si con esta devolución ya se devuelve todo lo que queda del ticket, se devuelve exactamente lo que
//   falta por devolver (así los redondeos de céntimos nunca descuadran).
// - Nunca se devuelve más de lo que se cobró.

export type LineaADevolver = {
  id: number;
  precioUnidad: number;
  cantidad: number;
  devueltas: number;
  aDevolver: number;
};

export function importesDevolucion(venta: { total: number; subtotal: number; yaDevuelto: number }, lineas: LineaADevolver[]) {
  const cent = (n: number) => Math.round(n * 100);
  const factor = venta.subtotal > 0 ? venta.total / venta.subtotal : 1;
  const pendiente = Math.max(cent(venta.total) - cent(venta.yaDevuelto), 0);
  const elegidas = lineas.filter((l) => l.aDevolver > 0);
  const porLinea = new Map<number, number>(elegidas.map((l) => [l.id, cent(l.aDevolver * l.precioUnidad * factor)]));
  let suma = [...porLinea.values()].reduce((s, c) => s + c, 0);
  const todo = elegidas.length > 0 && lineas.every((l) => l.devueltas + l.aDevolver >= l.cantidad);

  if (elegidas.length > 0 && (todo || suma > pendiente)) {
    // Ajuste de céntimos en la última línea elegida
    const ultima = elegidas[elegidas.length - 1].id;
    const objetivo = todo ? pendiente : Math.min(suma, pendiente);
    porLinea.set(ultima, Math.max(porLinea.get(ultima)! + (objetivo - suma), 0));
    suma = [...porLinea.values()].reduce((s, c) => s + c, 0);
  }
  return {
    porLinea: new Map([...porLinea].map(([id, c]) => [id, c / 100])),
    total: suma / 100,
  };
}
