"use client";

export default function ErrorPagina({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-semibold">Algo ha fallado</h1>
      <p className="mt-2 text-sm text-zinc-500">
        {error.message?.includes("DATABASE_URL") || error.message?.includes("ECONNREFUSED")
          ? "No se puede conectar con la base de datos. ¿Está arrancado Docker?"
          : "Prueba otra vez. Si se repite, revisa los logs del servidor."}
      </p>
      <button onClick={reset} className="btn mt-6">
        Reintentar
      </button>
    </div>
  );
}
