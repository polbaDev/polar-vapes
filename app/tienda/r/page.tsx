import { redirect } from "next/navigation";
import { basePublica } from "@/lib/origen";
import { limpiarCodigo, reservaPorCodigo } from "@/lib/reservas";

export const metadata = { title: "Mi reserva" };

// Buscar una reserva por su código
export default async function BuscarReserva({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  const [{ codigo }, base] = await Promise.all([searchParams, basePublica()]);
  const limpio = limpiarCodigo(codigo ?? "");
  const encontrada = limpio ? await reservaPorCodigo(limpio) : null;
  if (encontrada) redirect(`${base}/r/${encontrada.codigo}`);

  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="text-xl font-semibold">Mi reserva</h1>
      <p className="mt-1 text-sm text-zinc-500">Escribe el código que te dimos al reservar.</p>
      <form action={`${base}/r`} className="mt-5 space-y-3">
        <input
          name="codigo"
          defaultValue={codigo}
          placeholder="R-XXXXXX"
          autoCapitalize="characters"
          autoComplete="off"
          required
          className="campo py-3 text-center font-mono text-lg uppercase tracking-wider"
          aria-label="Código de reserva"
        />
        {codigo && <p className="text-sm text-red-700">No encontramos ninguna reserva con ese código.</p>}
        <button className="btn w-full py-3">Ver reserva</button>
      </form>
    </div>
  );
}
