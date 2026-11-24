import { CATEGORIAS_SABOR, TIPOS_PRODUCTO } from "@/lib/constants";
import { traductor } from "@/lib/i18n/servidor";
import { CampoCodigoBarras } from "./escaner";

// Componentes de servidor (solo los usan páginas del catálogo): traducen con traductor()

type Marca = { id: number; nombre: string };

export async function CamposProducto({
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
  const t = await traductor();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="etiqueta" htmlFor="marca_id">
          {t("Marca")}
        </label>
        <select id="marca_id" name="marca_id" className="campo" defaultValue={valores?.marcaId ?? ""}>
          <option value="">{t("— Elige —")}</option>
          {marcas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="etiqueta" htmlFor="marca_nueva">
          {t("…o marca nueva")}
        </label>
        <input id="marca_nueva" name="marca_nueva" className="campo" placeholder={t("Escribe para crearla")} />
      </div>
      <div>
        <label className="etiqueta" htmlFor="modelo">
          {t("Modelo")}
        </label>
        <input
          id="modelo"
          name="modelo"
          required
          className="campo"
          defaultValue={valores?.modelo}
          placeholder={t("Ej. 600, Pro 5000, Pod S")}
        />
      </div>
      <div>
        <label className="etiqueta" htmlFor="tipo">
          {t("Tipo")}
        </label>
        <select id="tipo" name="tipo" className="campo" defaultValue={valores?.tipo ?? "desechable"}>
          {TIPOS_PRODUCTO.map((x) => (
            <option key={x.value} value={x.value}>
              {t(x.label)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="etiqueta" htmlFor="caladas">
          {t("Caladas")} <span className="font-normal text-zinc-400">{t("(opcional)")}</span>
        </label>
        <input id="caladas" name="caladas" type="number" min={0} inputMode="numeric" className="campo" defaultValue={valores?.caladas ?? ""} />
      </div>
      <div>
        <label className="etiqueta" htmlFor="ml">
          {t("Mililitros")} <span className="font-normal text-zinc-400">{t("(opcional)")}</span>
        </label>
        <input id="ml" name="ml" type="number" min={0} step="0.1" inputMode="decimal" className="campo" defaultValue={valores?.ml ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <label className="etiqueta" htmlFor="descripcion">
          {t("Descripción")} <span className="font-normal text-zinc-400">{t("(opcional)")}</span>
        </label>
        <textarea id="descripcion" name="descripcion" rows={2} className="campo" defaultValue={valores?.descripcion ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <label className="etiqueta" htmlFor="caracteristicas">
          {t("Características")}{" "}
          <span className="font-normal text-zinc-400">{t("(una por línea: batería, carga, resistencia…)")}</span>
        </label>
        <textarea
          id="caracteristicas"
          name="caracteristicas"
          rows={4}
          className="campo"
          defaultValue={valores?.caracteristicas ?? ""}
          placeholder={t("Batería 650 mAh\nCarga USB tipo C")}
        />
      </div>
    </div>
  );
}

export async function CamposVariante({
  sabores,
  valores,
  idSufijo = "",
}: {
  sabores: { nombre: string }[];
  valores?: { sabor?: string; nicotinaMg?: number; precioVenta?: string; stockMinimo?: number; codigoBarras?: string | null };
  idSufijo?: string;
}) {
  const t = await traductor();
  const lista = `lista-sabores${idSufijo}`;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="sm:col-span-2 lg:col-span-1">
        <label className="etiqueta" htmlFor={`sabor${idSufijo}`}>
          {t("Sabor")}
        </label>
        <input
          id={`sabor${idSufijo}`}
          name="sabor"
          list={lista}
          required
          autoComplete="off"
          className="campo"
          defaultValue={valores?.sabor}
          placeholder={t("Elige o escribe uno nuevo")}
        />
        <datalist id={lista}>
          {sabores.map((s) => (
            <option key={s.nombre} value={s.nombre} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="etiqueta" htmlFor={`categoria${idSufijo}`}>
          {t("Categoría")} <span className="font-normal text-zinc-400">{t("(si el sabor es nuevo)")}</span>
        </label>
        <select id={`categoria${idSufijo}`} name="categoria" className="campo" defaultValue="fruta">
          {CATEGORIAS_SABOR.map((c) => (
            <option key={c.value} value={c.value}>
              {t(c.label)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="etiqueta" htmlFor={`nicotina${idSufijo}`}>
          {t("Nicotina (mg)")}
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
          {t("Precio de venta (€)")}
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
          {t("Avisar cuando queden")}
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
          {t("Código de barras")} <span className="font-normal text-zinc-400">{t("(opcional)")}</span>
        </label>
        <CampoCodigoBarras id={`codigo${idSufijo}`} defaultValue={valores?.codigoBarras ?? ""} />
      </div>
    </div>
  );
}
