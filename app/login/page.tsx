import { FormAccion, BotonEnviar } from "@/components/form-accion";
import { entrar } from "@/lib/actions/auth";

export const metadata = { title: "Entrar · Gestión Vapers" };

export default function Login() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src="/icon.svg" alt="" className="h-12 w-12" />
          <h1 className="text-xl font-semibold">Gestión Vapers</h1>
        </div>
        <FormAccion accion={entrar} className="tarjeta space-y-4 p-6">
          <div>
            <label htmlFor="password" className="etiqueta">
              Contraseña
            </label>
            <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus className="campo" />
          </div>
          <BotonEnviar className="btn w-full" textoPendiente="Entrando…">
            Entrar
          </BotonEnviar>
        </FormAccion>
      </div>
    </main>
  );
}
