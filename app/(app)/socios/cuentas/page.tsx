import { Cabecera, Insignia } from "@/components/ui";
import { FormAccion, BotonEnviar } from "@/components/form-accion";
import { activarCuenta, cambiarClaveDe, cambiarMiClave, crearCuenta, editarCuenta, guardarDestinoTarjeta } from "@/lib/actions/cuentas";
import { MIN_CLAVE } from "@/lib/claves";
import { exigirSesion } from "@/lib/session";
import { tarjetaRecibe } from "@/lib/socios";
import { listarUsuarios } from "@/lib/usuarios";
import { traductor } from "@/lib/i18n/servidor";

export async function generateMetadata() {
  const t = await traductor();
  return { title: t("Cuentas y contraseñas") };
}

export default async function Cuentas({ searchParams }: { searchParams: Promise<{ primera?: string }> }) {
  const t = await traductor();
  const [{ primera }, yo, cuentas, tarjeta] = await Promise.all([searchParams, exigirSesion(), listarUsuarios(), tarjetaRecibe()]);
  const socios = cuentas.filter((c) => c.socio && c.activo);

  return (
    <>
      <Cabecera
        titulo={t("Cuentas y contraseñas")}
        subtitulo={t("Cada persona entra con su nombre y su contraseña, y lo que hace queda a su nombre.")}
        volver={{ href: "/socios", texto: t("Socios") }}
      />

      {primera && cuentas.length === 1 && (
        <div className="mb-6 max-w-3xl rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-semibold">{t("Tu cuenta está lista.")}</p>
          <p className="mt-1">
            {t("Ahora crea la de tu socio aquí abajo, con una contraseña provisional. Cuando entre, que la cambie en «Mi contraseña».")}
          </p>
        </div>
      )}

      <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="font-semibold">{t("Cuentas")}</h2>
          {cuentas.map((c) => (
            <div key={c.id} className={`tarjeta p-4 ${c.activo ? "" : "opacity-70"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{c.nombre}</span>
                  {c.id === yo.id && <Insignia tono="marca">{t("Tú")}</Insignia>}
                  {c.socio ? <Insignia tono="verde">{t("Socio")}</Insignia> : <Insignia>{t("No es socio")}</Insignia>}
                  {!c.activo && <Insignia tono="rojo">{t("Desactivada")}</Insignia>}
                </div>
              </div>
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-zinc-500 hover:text-zinc-800">{t("Cambiar")}</summary>
                <div className="mt-3 space-y-4">
                  <FormAccion accion={editarCuenta} className="space-y-3">
                    <input type="hidden" name="id" value={c.id} />
                    <div>
                      <label className="etiqueta" htmlFor={`nombre_${c.id}`}>
                        {t("Nombre")}
                      </label>
                      <input id={`nombre_${c.id}`} name="nombre" defaultValue={c.nombre} required maxLength={40} className="campo" />
                    </div>
                    <label className="flex items-start gap-2">
                      <input type="checkbox" name="socio" defaultChecked={c.socio} className="mt-0.5 h-4 w-4" />
                      <span>
                        <span className="block font-medium">{t("Es socio")}</span>
                        <span className="text-zinc-500">{t("Entra en el reparto y puede tener dinero de la tienda.")}</span>
                      </span>
                    </label>
                    <BotonEnviar className="btn-sec">{t("Guardar")}</BotonEnviar>
                  </FormAccion>

                  {c.id !== yo.id && (
                    <>
                      <FormAccion accion={cambiarClaveDe} limpiarAlGuardar className="space-y-2 border-t border-zinc-100 pt-3">
                        <input type="hidden" name="id" value={c.id} />
                        <label className="etiqueta" htmlFor={`clave_${c.id}`}>
                          {t("Contraseña nueva para {nombre}", { nombre: c.nombre })}
                        </label>
                        <div className="flex gap-2">
                          <input
                            id={`clave_${c.id}`}
                            name="clave"
                            type="password"
                            autoComplete="new-password"
                            required
                            minLength={MIN_CLAVE}
                            className="campo"
                          />
                          <BotonEnviar className="btn-sec shrink-0">{t("Cambiar")}</BotonEnviar>
                        </div>
                        <p className="text-xs text-zinc-500">{t("Si se le ha olvidado. Tendrá que volver a entrar en sus dispositivos.")}</p>
                      </FormAccion>
                      <FormAccion accion={activarCuenta} className="border-t border-zinc-100 pt-3">
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="activo" value={c.activo ? "0" : "1"} />
                        <p className="mb-2 text-zinc-500">
                          {c.activo
                            ? t("Si la desactivas no podrá entrar y se cerrarán sus sesiones. Sus ventas y su dinero siguen a su nombre.")
                            : t("Si la activas podrá volver a entrar con su contraseña.")}
                        </p>
                        <BotonEnviar className={c.activo ? "btn-peligro" : "btn-sec"}>
                          {c.activo ? t("Desactivar cuenta") : t("Activar cuenta")}
                        </BotonEnviar>
                      </FormAccion>
                    </>
                  )}
                </div>
              </details>
            </div>
          ))}

          <FormAccion accion={crearCuenta} limpiarAlGuardar className="tarjeta space-y-3 p-4">
            <h3 className="font-semibold">{t("Nueva cuenta")}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="etiqueta" htmlFor="nombre_nueva">
                  {t("Nombre")}
                </label>
                <input id="nombre_nueva" name="nombre" required maxLength={40} autoComplete="off" className="campo" />
              </div>
              <div>
                <label className="etiqueta" htmlFor="clave_nueva">
                  {t("Contraseña provisional")}
                </label>
                <input id="clave_nueva" name="clave" type="password" autoComplete="new-password" required minLength={MIN_CLAVE} className="campo" />
              </div>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="socio" defaultChecked className="mt-0.5 h-4 w-4" />
              <span>
                <span className="block font-medium">{t("Es socio")}</span>
                <span className="text-zinc-500">{t("Desmárcalo para una cuenta compartida de la tienda o de alguien que no entra en el reparto.")}</span>
              </span>
            </label>
            <BotonEnviar>{t("Crear cuenta")}</BotonEnviar>
          </FormAccion>
        </section>

        <div className="space-y-6">
          <FormAccion accion={cambiarMiClave} limpiarAlGuardar className="tarjeta space-y-3 p-4">
            <h2 className="font-semibold">{t("Mi contraseña")}</h2>
            <div>
              <label className="etiqueta" htmlFor="actual">
                {t("Contraseña actual")}
              </label>
              <input id="actual" name="actual" type="password" autoComplete="current-password" required className="campo" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="etiqueta" htmlFor="clave_mia">
                  {t("Nueva")}
                </label>
                <input id="clave_mia" name="clave" type="password" autoComplete="new-password" required minLength={MIN_CLAVE} className="campo" />
              </div>
              <div>
                <label className="etiqueta" htmlFor="repetir_mia">
                  {t("Repítela")}
                </label>
                <input id="repetir_mia" name="repetir" type="password" autoComplete="new-password" required className="campo" />
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              {t("Al menos {n} caracteres. Tus otros dispositivos tendrán que volver a entrar.", { n: MIN_CLAVE })}
            </p>
            <BotonEnviar>{t("Cambiar mi contraseña")}</BotonEnviar>
          </FormAccion>

          {socios.length > 0 && (
            <FormAccion accion={guardarDestinoTarjeta} className="tarjeta space-y-3 p-4">
              <h2 className="font-semibold">{t("Dinero de la tarjeta")}</h2>
              <p className="text-sm text-zinc-500">
                {t("¿En qué cuenta del banco ingresa el datáfono? Si es la de un socio, lo cobrado con tarjeta cuenta como dinero de la tienda que tiene ese socio.")}
              </p>
              <select name="tarjeta" defaultValue={tarjeta ?? "comun"} className="campo" aria-label={t("Dinero de la tarjeta")}>
                <option value="comun">{t("En la cuenta de la tienda (de los dos)")}</option>
                {socios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {t("En la cuenta de {nombre}", { nombre: s.nombre })}
                  </option>
                ))}
              </select>
              <BotonEnviar className="btn-sec">{t("Guardar")}</BotonEnviar>
            </FormAccion>
          )}
        </div>
      </div>
    </>
  );
}
