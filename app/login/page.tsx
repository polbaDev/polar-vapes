import { FormAccion, BotonEnviar } from "@/components/form-accion";
import { MenuPreferencias } from "@/components/preferencias";
import { entrar } from "@/lib/actions/auth";
import { traductor } from "@/lib/i18n/servidor";

export async function generateMetadata() {
  const t = await traductor();
  return { title: t("Entrar") };
}

export default async function Login() {
  const t = await traductor();
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-4">
      <div className="absolute right-4 top-4">
        <MenuPreferencias />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-4 text-center">
          <img src="/icon.svg" alt="" className="h-14 w-14" />
          <div>
            <h1 className="titulo-pagina">Boira</h1>
            <p className="mt-2 text-sm text-zinc-500">{t("Control de compras, ventas y stock")}</p>
          </div>
        </div>
        <FormAccion accion={entrar} className="tarjeta space-y-4 p-6">
          <div>
            <label htmlFor="password" className="etiqueta">
              {t("Contraseña")}
            </label>
            <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus className="campo" />
          </div>
          <BotonEnviar className="btn w-full py-2.5" textoPendiente={t("Entrando…")}>
            {t("Entrar")}
          </BotonEnviar>
        </FormAccion>
      </div>
    </main>
  );
}
