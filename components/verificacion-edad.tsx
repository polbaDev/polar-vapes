"use client";

import { useEffect, useState } from "react";
import { useT } from "./preferencias";

const CLAVE = "mayor_de_edad";

// Pregunta la edad al entrar al catálogo (se recuerda en este navegador)
export function VerificacionEdad() {
  const t = useT();
  const [estado, setEstado] = useState<"pregunta" | "ok" | "no">("pregunta");

  useEffect(() => {
    let ok = false;
    try {
      ok = localStorage.getItem(CLAVE) === "1";
    } catch {
      // Navegación privada o sin almacenamiento: se vuelve a preguntar
    }
    if (ok) setEstado("ok");
  }, []);

  if (estado === "ok") return null;

  function aceptar() {
    try {
      localStorage.setItem(CLAVE, "1");
    } catch {}
    setEstado("ok");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center velo p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-edad">
      <div className="tarjeta w-full max-w-sm p-6 text-center shadow-xl">
        <img src="/sello.svg" alt="PolAr Vapes" className="mx-auto mb-4 h-24 w-24" />
        {estado === "pregunta" ? (
          <>
            <h2 id="titulo-edad" className="font-display text-2xl font-semibold">
              {t("Solo para mayores de 18 años")}
            </h2>
            <p className="mt-2 text-sm text-zinc-600">{t("Este catálogo muestra productos con nicotina. ¿Eres mayor de edad?")}</p>
            <div className="mt-5 grid gap-2">
              <button type="button" onClick={aceptar} className="btn py-3">
                {t("Sí, tengo 18 años o más")}
              </button>
              <button type="button" onClick={() => setEstado("no")} className="btn-sec py-3">
                {t("No")}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="titulo-edad" className="font-display text-2xl font-semibold">
              {t("Lo sentimos")}
            </h2>
            <p className="mt-2 text-sm text-zinc-600">{t("Este catálogo es solo para mayores de edad.")}</p>
          </>
        )}
      </div>
    </div>
  );
}
