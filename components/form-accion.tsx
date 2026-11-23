"use client";

import { createContext, useActionState, useContext, useEffect, useRef, startTransition, type ReactNode, type FormEvent } from "react";
import type { Resultado } from "@/lib/actions/tipos";

type Accion = (prev: Resultado, fd: FormData) => Promise<Resultado>;

const Pendiente = createContext(false);

// Formulario que llama a una acción del servidor y muestra el resultado.
// No borra los campos si hay error (React 19 los borraría por defecto).
export function FormAccion({
  accion,
  children,
  className,
  limpiarAlGuardar = false,
}: {
  accion: Accion;
  children: ReactNode;
  className?: string;
  limpiarAlGuardar?: boolean;
}) {
  const [estado, ejecutar, pendiente] = useActionState(accion, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado?.ok && limpiarAlGuardar) ref.current?.reset();
  }, [estado, limpiarAlGuardar]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => ejecutar(fd));
  }

  return (
    <form ref={ref} onSubmit={onSubmit} className={className} aria-busy={pendiente}>
      <Pendiente.Provider value={pendiente}>{children}</Pendiente.Provider>
      {estado?.error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {estado.error}
        </p>
      )}
      {estado?.ok && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{estado.ok}</p>}
    </form>
  );
}

export function BotonEnviar({
  children,
  className = "btn",
  textoPendiente = "Guardando…",
}: {
  children: ReactNode;
  className?: string;
  textoPendiente?: string;
}) {
  const pending = useContext(Pendiente);
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? textoPendiente : children}
    </button>
  );
}
