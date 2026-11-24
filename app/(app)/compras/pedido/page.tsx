import { Cabecera } from "@/components/ui";
import { Pedido } from "@/components/pedido";
import { calcularPedidoSugerido } from "@/lib/pedido";
import { listarMarcas, listarProveedores } from "@/lib/queries";
import { fecha, hoyISO } from "@/lib/format";
import { telefonoWhatsApp } from "@/lib/ajustes";
import { traductor } from "@/lib/i18n/servidor";

export async function generateMetadata() {
  const t = await traductor();
  return { title: t("Pedido sugerido") };
}

const COBERTURAS = [7, 14, 21, 30, 45, 60];
const VENTANAS = [14, 30, 60, 90];

function entre(valor: string | undefined, permitidos: number[], porDefecto: number) {
  const n = Number(valor);
  return permitidos.includes(n) ? n : porDefecto;
}

export default async function PedidoSugerido({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string; ventana?: string; caja?: string; marca?: string; proveedor?: string }>;
}) {
  const t = await traductor();
  const sp = await searchParams;
  const cobertura = entre(sp.dias, COBERTURAS, 14);
  const ventana = entre(sp.ventana, VENTANAS, 30);
  const multiplo = Math.min(Math.max(Math.floor(Number(sp.caja) || 1), 1), 100);
  const marcaId = Number(sp.marca) || undefined;
  const proveedorId = Number(sp.proveedor) || undefined;

  const [lineas, marcas, proveedores] = await Promise.all([
    calcularPedidoSugerido({ ventana, cobertura, multiplo, marcaId, proveedorId }),
    listarMarcas(),
    listarProveedores(),
  ]);
  const proveedor = proveedores.find((p) => p.id === proveedorId) ?? null;

  return (
    <>
      <Cabecera
        titulo={t("Pedido sugerido")}
        subtitulo={t("Lo que te conviene pedir según lo que vendes y el stock que tienes. Puedes cambiar las cantidades antes de enviarlo.")}
        volver={{ href: "/compras", texto: t("Compras") }}
      />

      <form action="/compras/pedido" className="tarjeta mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
        <div>
          <label className="etiqueta" htmlFor="dias">
            {t("Stock para")}
          </label>
          <select id="dias" name="dias" defaultValue={cobertura} className="campo">
            {COBERTURAS.map((d) => (
              <option key={d} value={d}>
                {t("{n} días", { n: d })}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="etiqueta" htmlFor="ventana">
            {t("Según ventas de")}
          </label>
          <select id="ventana" name="ventana" defaultValue={ventana} className="campo">
            {VENTANAS.map((d) => (
              <option key={d} value={d}>
                {t("los últimos {n} días", { n: d })}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="etiqueta" htmlFor="caja">
            {t("En cajas de")}
          </label>
          <input id="caja" name="caja" type="number" min={1} max={100} defaultValue={multiplo} inputMode="numeric" className="campo" />
        </div>
        <div>
          <label className="etiqueta" htmlFor="marca">
            {t("Marca")}
          </label>
          <select id="marca" name="marca" defaultValue={marcaId ?? ""} className="campo">
            <option value="">{t("Todas")}</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="etiqueta" htmlFor="proveedor">
            {t("Proveedor")}
          </label>
          <select id="proveedor" name="proveedor" defaultValue={proveedorId ?? ""} className="campo">
            <option value="">{t("Todos")}</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <button className="btn">{t("Calcular")}</button>
        <p className="text-xs text-zinc-500 sm:col-span-2 lg:col-span-6">
          {t("Pide lo que venderías en esos días al ritmo actual, más el stock mínimo de cada sabor como colchón, menos lo que ya tienes.")}{" "}
          {t("«Proveedor» filtra por el último proveedor al que compraste cada sabor.")}
        </p>
      </form>

      <Pedido
        key={`${cobertura}-${ventana}-${multiplo}-${marcaId ?? ""}-${proveedorId ?? ""}`}
        lineas={lineas}
        ventana={ventana}
        fechaTexto={fecha(hoyISO())}
        proveedor={proveedor ? { id: proveedor.id, nombre: proveedor.nombre, telefono: telefonoWhatsApp(proveedor.telefono) } : null}
      />
    </>
  );
}
