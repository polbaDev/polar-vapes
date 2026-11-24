"use client";

import { useT } from "@/components/preferencias";

export default function ErrorPagina({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="titulo-pagina">{t("Algo ha fallado")}</h1>
      <p className="mt-3 text-sm text-zinc-500">
        {error.message?.includes("DATABASE_URL") || error.message?.includes("ECONNREFUSED")
          ? t("No se puede conectar con la base de datos. ¿Está arrancado Docker?")
          : t("Prueba otra vez. Si se repite, revisa los logs del servidor.")}
      </p>
      <button onClick={reset} className="btn mt-6">
        {t("Reintentar")}
      </button>
    </div>
  );
}
