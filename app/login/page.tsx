import { FormAccion, BotonEnviar } from "@/components/form-accion";
import { Logotipo } from "@/components/marca";
import { MenuPreferencias } from "@/components/preferencias";
import { crearPrimeraCuenta, entrar } from "@/lib/actions/auth";
import { MIN_CLAVE } from "@/lib/claves";
import { hayCuentas } from "@/lib/usuarios";
import { traductor } from "@/lib/i18n/servidor";
import { avisoAuth } from "@/lib/session";

export async function generateMetadata() {
  const t = await traductor();
  return { title: t("Entrar") };
}

export default async function Login() {
  const t = await traductor();
  // Sin APP_PASSWORD y AUTH_SECRET buenos no se deja entrar: se explica aquí antes de que escriban nada
  const aviso = avisoAuth(t);
  // Si la base de datos no responde se enseña la entrada normal: al probar, dirá qué pasa
  const primeraVez = !(await hayCuentas().catch(() => true));
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <MenuPreferencias />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-4 text-center">
          <img src="/sello.svg" alt="" className="h-28 w-28" />
          <div>
            <h1 className="titulo-pagina">
              <Logotipo />
            </h1>
            <p className="mt-2 text-sm text-zinc-500">{t("Control de compras, ventas y stock")}</p>
          </div>
        </div>
        {aviso && (
          <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {aviso}
          </p>
        )}
        {primeraVez ? (
          <FormAccion accion={crearPrimeraCuenta} className="tarjeta space-y-4 p-6">
            <div>
              <h2 className="font-semibold">{t("Crea tu cuenta")}</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {t("Cada uno entra con la suya y lo que hace queda a su nombre. Después crearás la de tu socio.")}
              </p>
            </div>
            <div>
              <label htmlFor="password_app" className="etiqueta">
                {t("Contraseña de la app")}
              </label>
              <input id="password_app" name="password_app" type="password" autoComplete="off" required autoFocus className="campo" />
              <p className="mt-1 text-xs text-zinc-500">{t("La que te enseñó arrancar.bat (APP_PASSWORD en el archivo .env). Solo hace falta esta vez.")}</p>
            </div>
            <div>
              <label htmlFor="nombre" className="etiqueta">
                {t("Tu nombre")}
              </label>
              <input id="nombre" name="nombre" autoComplete="username" required maxLength={40} className="campo" />
            </div>
            <div>
              <label htmlFor="clave" className="etiqueta">
                {t("Tu contraseña")}
              </label>
              <input id="clave" name="clave" type="password" autoComplete="new-password" required minLength={MIN_CLAVE} className="campo" />
              <p className="mt-1 text-xs text-zinc-500">{t("Al menos {n} caracteres.", { n: MIN_CLAVE })}</p>
            </div>
            <div>
              <label htmlFor="repetir" className="etiqueta">
                {t("Repite la contraseña")}
              </label>
              <input id="repetir" name="repetir" type="password" autoComplete="new-password" required className="campo" />
            </div>
            <BotonEnviar className="btn w-full py-2.5" textoPendiente={t("Creando…")}>
              {t("Crear cuenta y entrar")}
            </BotonEnviar>
          </FormAccion>
        ) : (
          <FormAccion accion={entrar} className="tarjeta space-y-4 p-6">
            <div>
              <label htmlFor="nombre" className="etiqueta">
                {t("Nombre")}
              </label>
              <input id="nombre" name="nombre" autoComplete="username" autoCapitalize="words" required autoFocus className="campo" />
            </div>
            <div>
              <label htmlFor="password" className="etiqueta">
                {t("Contraseña")}
              </label>
              <input id="password" name="password" type="password" autoComplete="current-password" required className="campo" />
            </div>
            <BotonEnviar className="btn w-full py-2.5" textoPendiente={t("Entrando…")}>
              {t("Entrar")}
            </BotonEnviar>
          </FormAccion>
        )}
      </div>
    </main>
  );
}
