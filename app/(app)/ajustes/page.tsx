import Link from "next/link";
import { Cabecera } from "@/components/ui";
import { FormAccion, BotonEnviar } from "@/components/form-accion";
import { cerrarSesionesTodas, guardarAjustes } from "@/lib/actions/ajustes";
import { leerAjustes, HORAS_CERRAR, MINUTOS_CONFIRMAR } from "@/lib/ajustes";
import type { T } from "@/lib/i18n";
import { traductor } from "@/lib/i18n/servidor";

export async function generateMetadata() {
  const t = await traductor();
  return { title: t("Ajustes del catálogo") };
}

function duracion(min: number, t: T) {
  if (min < 60) return t("{n} minutos", { n: min });
  if (min < 1440) return min === 60 ? t("1 hora") : t("{n} horas", { n: min / 60 });
  return t("1 día");
}

export default async function Ajustes() {
  const t = await traductor();
  const a = await leerAjustes();
  return (
    <>
      <Cabecera
        titulo={t("Ajustes del catálogo")}
        subtitulo={t("Lo que ven los clientes y cuánto duran las reservas.")}
        volver={{ href: "/reservas", texto: t("Reservas") }}
        acciones={
          <Link href="/tienda" target="_blank" className="btn-sec">
            {t("Ver catálogo")}
          </Link>
        }
      />
      <FormAccion accion={guardarAjustes} className="tarjeta max-w-2xl space-y-5 p-5">
        <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm">
          <input type="checkbox" name="catalogo_abierto" defaultChecked={a.catalogoAbierto} className="mt-0.5 h-4 w-4" />
          <span>
            <span className="block font-medium">{t("Catálogo abierto")}</span>
            <span className="text-zinc-500">{t("Si lo desmarcas, los clientes verán «Catálogo cerrado» y no podrán reservar.")}</span>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="etiqueta" htmlFor="nombre_tienda">
              {t("Nombre que ven los clientes")}
            </label>
            <input id="nombre_tienda" name="nombre_tienda" defaultValue={a.nombreTienda} required maxLength={60} className="campo" />
          </div>
          <div>
            <label className="etiqueta" htmlFor="whatsapp">
              {t("Tu WhatsApp")}
            </label>
            <input id="whatsapp" name="whatsapp" type="tel" defaultValue={a.whatsapp} placeholder="612 345 678" className="campo" />
            <p className="mt-1 text-xs text-zinc-500">
              {t("Adonde te llegan las reservas. Sin él, el cliente no tendrá el botón de WhatsApp.")}
            </p>
          </div>
        </div>

        <div>
          <label className="etiqueta" htmlFor="info">
            {t("Texto para los clientes")} <span className="font-normal text-zinc-400">{t("(opcional)")}</span>
          </label>
          <textarea
            id="info"
            name="info"
            rows={3}
            maxLength={500}
            defaultValue={a.info}
            placeholder={t("Ej. Horario de WhatsApp: de 10 a 21 h.")}
            className="campo"
          />
          <p className="mt-1 text-xs text-zinc-500">{t("Sale al hacer la reserva y en la página de cada reserva.")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="etiqueta" htmlFor="minutos_confirmar">
              {t("Para confirmarla")}
            </label>
            <select id="minutos_confirmar" name="minutos_confirmar" defaultValue={a.minutosConfirmar} className="campo">
              {MINUTOS_CONFIRMAR.map((m) => (
                <option key={m} value={m}>
                  {duracion(m, t)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">{t("Si no la confirmas en ese tiempo, caduca.")}</p>
          </div>
          <div>
            <label className="etiqueta" htmlFor="horas_cerrar">
              {t("Confirmada, apartada")}
            </label>
            <select id="horas_cerrar" name="horas_cerrar" defaultValue={a.horasCerrar} className="campo">
              {HORAS_CERRAR.map((h) => (
                <option key={h} value={h}>
                  {t("{n} horas", { n: h })}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">{t("Tiempo para cerrar la venta. Se puede ampliar.")}</p>
          </div>
          <div>
            <label className="etiqueta" htmlFor="max_unidades">
              {t("Máx. por reserva")}
            </label>
            <input id="max_unidades" name="max_unidades" type="number" min={1} max={50} defaultValue={a.maxUnidades} className="campo" />
            <p className="mt-1 text-xs text-zinc-500">{t("Unidades en total.")}</p>
          </div>
        </div>

        <BotonEnviar>{t("Guardar ajustes")}</BotonEnviar>
      </FormAccion>

      <div className="mt-6 max-w-2xl rounded-xl border border-zinc-200 bg-superficie p-4 text-sm text-zinc-600">
        <h2 className="font-semibold text-zinc-900">{t("Dónde está el catálogo")}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            {t("En este PC:")} <span className="font-mono">http://catalogo.localhost:3000</span> ({t("y la gestión en")}{" "}
            <span className="font-mono">http://gestion.localhost:3000</span>).
          </li>
          <li>
            {t("Cuando lo publiques:")} <span className="font-mono">https://catalogo.tudominio.es</span>.{" "}
            {t("Cualquier dirección que empiece por «catalogo.» enseña solo el catálogo.")}
          </li>
        </ul>
      </div>

      <FormAccion accion={cerrarSesionesTodas} className="tarjeta mt-6 max-w-2xl p-4">
        <h2 className="font-semibold">{t("Sesiones")}</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {t(
            "Si se pierde un móvil. Todos los dispositivos de todas las cuentas, también este, tendrán que volver a entrar. Para echar solo a una persona, desactiva su cuenta o cámbiale la contraseña en Socios → Cuentas y contraseñas.",
          )}
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" name="confirmar" className="h-4 w-4" /> {t("Sí, quiero cerrar la sesión en todos los dispositivos")}
        </label>
        <div className="mt-3">
          <BotonEnviar className="btn-peligro" textoPendiente={t("Cerrando sesiones…")}>
            {t("Cerrar sesión en todos los dispositivos")}
          </BotonEnviar>
        </div>
      </FormAccion>
    </>
  );
}
