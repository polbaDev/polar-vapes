// Cuentas entre socios a partes iguales (sin base de datos: se usa en el servidor y se puede probar suelto).
// El saldo de un socio es el dinero de la tienda que tiene en su poder: lo que ha cobrado o se ha llevado
// menos lo que ha pagado. Para quedar a la par, cada uno debería tener lo mismo: la media.

export type SaldoSocio = { id: number; nombre: string; saldo: number };
export type PagoSugerido = { deId: number; de: string; paraId: number; para: string; importe: number };

// Pagos para que todos queden con la misma parte, con el menor número de pagos razonable.
// Se calcula en céntimos: si la media no sale exacta, el céntimo que sobra se lo quedan los que más tienen.
export function pagosParaIgualar(saldos: SaldoSocio[]): PagoSugerido[] {
  if (saldos.length < 2) return [];
  const s = saldos.map((x) => ({ ...x, c: Math.round(x.saldo * 100) })).sort((a, b) => b.c - a.c || a.id - b.id);
  const total = s.reduce((suma, x) => suma + x.c, 0);
  const base = Math.floor(total / s.length);
  const resto = total - base * s.length;
  const dif = s.map((x, i) => ({ ...x, d: x.c - (base + (i < resto ? 1 : 0)) }));
  const pagan = dif.filter((x) => x.d > 0);
  const cobran = dif.filter((x) => x.d < 0).sort((a, b) => a.d - b.d);
  const pagos: PagoSugerido[] = [];
  let i = 0;
  let j = 0;
  while (i < pagan.length && j < cobran.length) {
    const c = Math.min(pagan[i].d, -cobran[j].d);
    pagos.push({ deId: pagan[i].id, de: pagan[i].nombre, paraId: cobran[j].id, para: cobran[j].nombre, importe: c / 100 });
    pagan[i].d -= c;
    cobran[j].d += c;
    if (pagan[i].d === 0) i++;
    if (cobran[j].d === 0) j++;
  }
  return pagos;
}

// Con dos socios: quién debería pagar la próxima compra y de cuánto tendría que ser para quedar a la par
export function proximaCompra(saldos: SaldoSocio[]) {
  if (saldos.length !== 2) return null;
  const [a, b] = [...saldos].sort((x, y) => y.saldo - x.saldo);
  const diferencia = Math.round((a.saldo - b.saldo) * 100) / 100;
  if (diferencia < 0.01) return null;
  return { id: a.id, nombre: a.nombre, importe: diferencia };
}
