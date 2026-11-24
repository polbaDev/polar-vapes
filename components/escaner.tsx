"use client";

import { useEffect, useRef, useState } from "react";
import { tx } from "@/lib/i18n";
import { useT } from "@/components/preferencias";

// Lector de códigos de barras con la cámara, usando el BarcodeDetector del navegador.
// Funciona en Chrome para Android (y algunos de escritorio). Necesita https o localhost:
// desde el móvil por la red de la tienda (http://192.168…) el navegador no deja usar la cámara.
// Un lector Bluetooth o USB funciona siempre: escribe el código y pulsa Intro en el buscador.

type Deteccion = { rawValue: string };
type Detector = { detect(fuente: HTMLVideoElement): Promise<Deteccion[]> };
type ClaseDetector = {
  new (opciones?: { formats?: string[] }): Detector;
  getSupportedFormats?: () => Promise<string[]>;
};

const FORMATOS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"];

function claseDetector(): ClaseDetector | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { BarcodeDetector?: ClaseDetector }).BarcodeDetector ?? null;
}

export function useCamaraDisponible() {
  const [disponible, setDisponible] = useState(false);
  useEffect(() => {
    setDisponible(Boolean(window.isSecureContext && claseDetector() && navigator.mediaDevices?.getUserMedia));
  }, []);
  return disponible;
}

export function BotonCamara({ onClick, etiqueta }: { onClick: () => void; etiqueta?: string }) {
  const t = useT();
  const texto = etiqueta ?? t("Escanear con la cámara");
  return (
    <button type="button" onClick={onClick} className="btn-sec shrink-0 px-3" aria-label={texto} title={texto}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M8 8v8M11 8v8M14 8v8M17 8v8" />
      </svg>
    </button>
  );
}

export function Escaner({
  alDetectar,
  alCerrar,
  continuo = false,
}: {
  // Devuelve un mensaje para mostrar (p. ej. «Añadido: Cotton Candy»)
  alDetectar: (codigo: string) => string | void;
  alCerrar: () => void;
  // continuo: sigue leyendo después de cada código (para el TPV). Si no, se cierra al primero.
  continuo?: boolean;
}) {
  const t = useT();
  const video = useRef<HTMLVideoElement>(null);
  const detectar = useRef(alDetectar);
  const cerrar = useRef(alCerrar);
  const traducir = useRef(t);
  const [aviso, setAviso] = useState<string | null>(null);
  // Clave del error (en castellano): se traduce al pintarlo
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    detectar.current = alDetectar;
    cerrar.current = alCerrar;
    traducir.current = t;
  });

  useEffect(() => {
    let parar = false;
    let stream: MediaStream | null = null;
    // Para no leer el mismo código muchas veces mientras sigue delante de la cámara
    let ultimo = { codigo: "", visto: 0 };

    async function iniciar() {
      const Clase = claseDetector();
      if (!Clase) return setError(tx("Este navegador no puede leer códigos con la cámara."));
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch {
        return setError(tx("No se pudo abrir la cámara. Revisa que el navegador tenga permiso."));
      }
      if (parar) return stream.getTracks().forEach((t) => t.stop());
      const v = video.current;
      if (!v) return;
      v.srcObject = stream;
      await v.play().catch(() => {});
      const soportados = (await Clase.getSupportedFormats?.().catch(() => FORMATOS)) ?? FORMATOS;
      const formatos = FORMATOS.filter((f) => soportados.includes(f));
      const detector = new Clase(formatos.length ? { formats: formatos } : undefined);

      while (!parar) {
        try {
          if (v.readyState >= 2) {
            const [d] = await detector.detect(v);
            const ahora = Date.now();
            if (d?.rawValue) {
              const repetido = d.rawValue === ultimo.codigo && ahora - ultimo.visto < 2000;
              ultimo = { codigo: d.rawValue, visto: ahora };
              if (!repetido) {
                navigator.vibrate?.(60);
                const mensaje = detectar.current(d.rawValue);
                if (!continuo) {
                  cerrar.current();
                  return;
                }
                const t = traducir.current;
                setAviso(mensaje || t("Leído: {codigo}", { codigo: d.rawValue }));
              }
            }
          }
        } catch {
          // Un fotograma que no se puede analizar: se prueba con el siguiente
        }
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    iniciar();
    return () => {
      parar = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [continuo]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black" role="dialog" aria-label={t("Escanear código de barras")}>
      <div className="relative flex-1 overflow-hidden">
        <video ref={video} playsInline muted className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-36 -translate-y-1/2 rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      </div>
      <div className="space-y-3 bg-neutral-900 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-center text-white">
        <p className={`min-h-5 text-sm ${error ? "text-red-300" : ""}`} aria-live="polite">
          {error ? t(error) : (aviso ?? t("Apunta al código de barras"))}
        </p>
        <button type="button" onClick={alCerrar} className="btn w-full py-3 text-base">
          {continuo ? t("Listo") : t("Cancelar")}
        </button>
      </div>
    </div>
  );
}

// Campo de código de barras del catálogo con botón para leerlo con la cámara
export function CampoCodigoBarras({ id, defaultValue }: { id: string; defaultValue: string }) {
  const t = useT();
  const camara = useCamaraDisponible();
  const [abierto, setAbierto] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  return (
    <>
      <div className="flex gap-2">
        <input ref={campo} id={id} name="codigo_barras" className="campo" defaultValue={defaultValue} />
        {camara && <BotonCamara onClick={() => setAbierto(true)} etiqueta={t("Leer el código con la cámara")} />}
      </div>
      {abierto && (
        <Escaner
          alDetectar={(codigo) => {
            if (campo.current) campo.current.value = codigo;
          }}
          alCerrar={() => setAbierto(false)}
        />
      )}
    </>
  );
}
