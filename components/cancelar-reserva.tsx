"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelarReservaCliente } from "@/lib/actions/reservas";

export function CancelarReserva({ codigo }: { codigo: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function cancelar() {
    if (!window.confirm("¿Seguro que quieres cancelar la reserva? Los productos dejarán de estar apartados.")) return;
    startTransition(async () => {
      const r = await cancelarReservaCliente(codigo);
      if (r?.error) return setError(r.error);
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" onClick={cancelar} disabled={pendiente} className="btn-peligro w-full">
        {pendiente ? "Cancelando…" : "Cancelar reserva"}
      </button>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </>
  );
}
