"use client";

import { useEffect, useState } from "react";

const CLAVE = "mayor_de_edad";

// Pregunta la edad al entrar al catálogo (se recuerda en este navegador)
export function VerificacionEdad() {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="titulo-edad">
      <div className="tarjeta w-full max-w-sm p-6 text-center shadow-xl">
        {estado === "pregunta" ? (
          <>
            <h2 id="titulo-edad" className="text-lg font-semibold">
              Solo para mayores de 18 años
            </h2>
            <p className="mt-2 text-sm text-zinc-600">Este catálogo muestra productos con nicotina. ¿Eres mayor de edad?</p>
            <div className="mt-5 grid gap-2">
              <button type="button" onClick={aceptar} className="btn py-3">
                Sí, tengo 18 años o más
              </button>
              <button type="button" onClick={() => setEstado("no")} className="btn-sec py-3">
                No
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="titulo-edad" className="text-lg font-semibold">
              Lo sentimos
            </h2>
            <p className="mt-2 text-sm text-zinc-600">Este catálogo es solo para mayores de edad.</p>
          </>
        )}
      </div>
    </div>
  );
}
