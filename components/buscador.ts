export type VarianteLigera = {
  id: number;
  productoId: number;
  marca: string;
  modelo: string;
  sabor: string;
  nicotinaMg: number;
  precio: number;
  coste: number;
  stock: number;
  codigo: string | null;
  imagenId: number | null;
  color: string | null;
  // Unidades vendidas en los últimos 30 días
  vendidas: number;
};

// «Razz Bar» + «60K» → «Razz Bar 60K»; si el modelo ya lleva la marca («Elf Bar 600»), no se repite
export function nombreModelo(v: { marca: string; modelo: string }) {
  return normalizar(v.modelo).startsWith(normalizar(v.marca)) ? v.modelo : `${v.marca} ${v.modelo}`;
}

export function normalizar(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Todos los términos escritos deben aparecer (en cualquier orden)
export function filtrarVariantes(lista: VarianteLigera[], q: string, max = 40) {
  const terminos = normalizar(q).split(/\s+/).filter(Boolean);
  if (terminos.length === 0) return lista.slice(0, max);
  const res: VarianteLigera[] = [];
  for (const v of lista) {
    const texto = normalizar(`${v.marca} ${v.modelo} ${v.sabor} ${v.nicotinaMg}mg ${v.codigo ?? ""}`);
    if (terminos.every((t) => texto.includes(t))) {
      res.push(v);
      if (res.length >= max) break;
    }
  }
  return res;
}

export function porCodigo(lista: VarianteLigera[], q: string) {
  const c = q.trim();
  if (!c) return null;
  return lista.find((v) => v.codigo && v.codigo === c) ?? null;
}
