// Cálculo del pedido sugerido para una variante. Sin dependencias, para poder probarlo aparte.
//
// ritmo     = unidades vendidas / días con historial (como mucho la ventana elegida; si el producto
//             entró en stock hace menos, se usan solo esos días para no infravalorar lo que se vende)
// objetivo  = lo que venderás en los días de cobertura + el stock mínimo como colchón
// sugerido  = objetivo − stock, redondeado hacia arriba (y al múltiplo de la caja, si se indica)

export type DatosPedido = {
  stock: number;
  minimo: number;
  vendidas: number;
  diasHistorial: number;
  diasCobertura: number;
  multiplo?: number;
};

export type ResultadoPedido = {
  // unidades por día
  ritmo: number;
  // días que dura el stock actual al ritmo actual (null si no se vende)
  diasRestantes: number | null;
  sugerido: number;
};

export function calcularPedido(d: DatosPedido): ResultadoPedido {
  const stock = Math.max(d.stock, 0);
  const ritmo = d.diasHistorial > 0 ? Math.max(d.vendidas, 0) / d.diasHistorial : 0;
  const diasRestantes = ritmo > 0 ? stock / ritmo : null;
  const objetivo = ritmo * Math.max(d.diasCobertura, 0) + Math.max(d.minimo, 0);
  // El pequeño margen evita pedir una unidad de más por errores de coma flotante (p. ej. 9.000000001)
  let sugerido = Math.ceil(objetivo - stock - 1e-9);
  if (sugerido <= 0) return { ritmo, diasRestantes, sugerido: 0 };
  const multiplo = Math.max(Math.floor(d.multiplo ?? 1), 1);
  if (multiplo > 1) sugerido = Math.ceil(sugerido / multiplo) * multiplo;
  return { ritmo, diasRestantes, sugerido };
}
