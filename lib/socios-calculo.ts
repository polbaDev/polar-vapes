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

const centimos = (n: number) => Math.round(n * 100) / 100;

export type CuentaSocio = SaldoSocio & { tiene: number; aportado: number };
export type ParteSocio = CuentaSocio & { suyo: number; diferencia: number };

// De quién es el bote. Las ganancias son lo que hay en el bote por encima de lo que habéis aportado
// (negativas: hay menos de lo aportado, porque está en stock sin vender). Lo de cada uno («suyo») es lo
// que aportó más su parte igual de las ganancias. diferencia = lo que tiene − lo suyo: positiva, tiene
// dinero del otro; negativa, el otro tiene dinero suyo. Es lo mismo que igualar los saldos.
export function repartoBote(socios: CuentaSocio[]) {
  const bote = centimos(socios.reduce((s, x) => s + x.tiene, 0));
  const aportado = centimos(socios.reduce((s, x) => s + x.aportado, 0));
  const ganancias = centimos(bote - aportado);
  const porSocio = socios.length ? ganancias / socios.length : 0;
  const partes: ParteSocio[] = socios.map((x) => {
    const suyo = centimos(x.aportado + porSocio);
    return { ...x, suyo, diferencia: centimos(x.tiene - suyo) };
  });
  return { bote, aportado, ganancias, porSocio: centimos(porSocio), partes };
}

// Pagos entre socios para que, después de pagar una compra de `importe` el socio `pagaId`, sigáis a medias
export function pagosParaCompra(saldos: SaldoSocio[], pagaId: number, importe: number): PagoSugerido[] {
  if (!(importe > 0) || !saldos.some((s) => s.id === pagaId)) return [];
  return pagosParaIgualar(saldos.map((s) => (s.id === pagaId ? { ...s, saldo: s.saldo - importe } : s)));
}
