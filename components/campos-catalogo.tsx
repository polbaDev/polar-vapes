import { CATEGORIAS_SABOR, TIPOS_PRODUCTO } from "@/lib/constants";

type Marca = { id: number; nombre: string };

export function CamposProducto({
  marcas,
  valores,
}: {
  marcas: Marca[];
  valores?: {
    marcaId?: number;
    modelo?: string;
    tipo?: string;
    caladas?: number | null;
    ml?: string | null;
    descripcion?: string | null;
    caracteristicas?: string | null;
  };
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="etiqueta" htmlFor="marca_id">
          Marca
        </label>
        <select id="marca_id" name="marca_id" className="campo" defaultValue={valores?.marcaId ?? ""}>
          <option value="">— Elige —</option>
          {marcas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="etiqueta" htmlFor="marca_nueva">
          …o marca nueva
        </label>
        <input id="marca_nueva" name="marca_nueva" className="campo" placeholder="Escribe para crearla" />
      </div>
      <div>
        <label className="etiqueta" htmlFor="modelo">
          Modelo
        </label>
        <input id="modelo" name="modelo" required className="campo" defaultValue={valores?.modelo} placeholder="Ej. 600, Pro 5000, Pod S" />
      </div>
      <div>
        <label className="etiqueta" htmlFor="tipo">
          Tipo
        </label>
        <select id="tipo" name="tipo" className="campo" defaultValue={valores?.tipo ?? "desechable"}>
          {TIPOS_PRODUCTO.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="etiqueta" htmlFor="caladas">
          Caladas <span className="font-normal text-zinc-400">(opcional)</span>
        </label>
        <input id="caladas" name="caladas" type="number" min={0} inputMode="numeric" className="campo" defaultValue={valores?.caladas ?? ""} />
      </div>
      <div>
        <label className="etiqueta" htmlFor="ml">
          Mililitros <span className="font-normal text-zinc-400">(opcional)</span>
        </label>
        <input id="ml" name="ml" type="number" min={0} step="0.1" inputMode="decimal" className="campo" defaultValue={valores?.ml ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <label className="etiqueta" htmlFor="descripcion">
          Descripción <span className="font-normal text-zinc-400">(opcional)</span>
        </label>
        <textarea id="descripcion" name="descripcion" rows={2} className="campo" defaultValue={valores?.descripcion ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <label className="etiqueta" htmlFor="caracteristicas">
          Características <span className="font-normal text-zinc-400">(una por línea: batería, carga, resistencia…)</span>
        </label>
        <textarea
          id="caracteristicas"
          name="caracteristicas"
          rows={4}
          className="campo"
          defaultValue={valores?.caracteristicas ?? ""}
          placeholder={"Batería 650 mAh\nCarga USB tipo C"}
        />
      </div>
    </div>
  );
}

export function CamposVariante({
  sabores,
  valores,
  idSufijo = "",
}: {
  sabores: { nombre: string }[];
  valores?: { sabor?: string; nicotinaMg?: number; precioVenta?: string; stockMinimo?: number; codigoBarras?: string | null };
  idSufijo?: string;
}) {
  const lista = `lista-sabores${idSufijo}`;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="sm:col-span-2 lg:col-span-1">
        <label className="etiqueta" htmlFor={`sabor${idSufijo}`}>
          Sabor
        </label>
        <input
          id={`sabor${idSufijo}`}
          name="sabor"
          list={lista}
          required
          autoComplete="off"
          className="campo"
          defaultValue={valores?.sabor}
          placeholder="Elige o escribe uno nuevo"
        />
        <datalist id={lista}>
          {sabores.map((s) => (
            <option key={s.nombre} value={s.nombre} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="etiqueta" htmlFor={`categoria${idSufijo}`}>
          Categoría <span className="font-normal text-zinc-400">(si el sabor es nuevo)</span>
        </label>
        <select id={`categoria${idSufijo}`} name="categoria" className="campo" defaultValue="fruta">
          {CATEGORIAS_SABOR.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="etiqueta" htmlFor={`nicotina${idSufijo}`}>
          Nicotina (mg)
        </label>
        <input
          id={`nicotina${idSufijo}`}
          name="nicotina_mg"
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          className="campo"
          defaultValue={valores?.nicotinaMg ?? 20}
        />
      </div>
      <div>
        <label className="etiqueta" htmlFor={`precio${idSufijo}`}>
          Precio de venta (€)
        </label>
        <input
          id={`precio${idSufijo}`}
          name="precio_venta"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          required
          className="campo"
          defaultValue={valores?.precioVenta ?? ""}
        />
      </div>
      <div>
        <label className="etiqueta" htmlFor={`minimo${idSufijo}`}>
          Avisar cuando queden
        </label>
        <input
          id={`minimo${idSufijo}`}
          name="stock_minimo"
          type="number"
          min={0}
          inputMode="numeric"
          className="campo"
          defaultValue={valores?.stockMinimo ?? 3}
        />
      </div>
      <div>
        <label className="etiqueta" htmlFor={`codigo${idSufijo}`}>
          Código de barras <span className="font-normal text-zinc-400">(opcional)</span>
        </label>
        <input id={`codigo${idSufijo}`} name="codigo_barras" className="campo" defaultValue={valores?.codigoBarras ?? ""} />
      </div>
    </div>
  );
}
