"use client";

import { useRef, useState, useTransition } from "react";
import { cambiarImagen } from "@/lib/actions/catalogo";
import type { Resultado } from "@/lib/actions/tipos";
import { useT } from "@/components/preferencias";

// Reduce la foto en el navegador (máx. 1400 px) para que suba rápido desde el móvil
async function reducir(archivo: File): Promise<File> {
  if (!archivo.type.startsWith("image/") || archivo.type === "image/gif") return archivo;
  try {
    const bmp = await createImageBitmap(archivo);
    const max = 1400;
    const escala = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * escala);
    const h = Math.round(bmp.height * escala);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/webp", 0.9));
    if (!blob || blob.size >= archivo.size) return archivo;
    return new File([blob], archivo.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    return archivo;
  }
}

export function EditorImagen({
  destino,
  id,
  tieneImagen,
}: {
  destino: "producto" | "variante";
  id: number;
  tieneImagen: boolean;
}) {
  const t = useT();
  const [estado, setEstado] = useState<Resultado>(null);
  const [url, setUrl] = useState("");
  const [pendiente, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function enviar(datos: Record<string, string | File>) {
    const fd = new FormData();
    fd.set("destino", destino);
    fd.set("id", String(id));
    for (const [k, v] of Object.entries(datos)) fd.set(k, v);
    start(async () => {
      try {
        const r = await cambiarImagen(null, fd);
        setEstado(r);
        if (r?.ok) setUrl("");
      } catch {
        setEstado({ error: t("No se pudo subir. ¿La foto pesa demasiado?") });
      }
    });
  }

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setEstado(null);
    const reducido = await reducir(f);
    enviar({ archivo: reducido });
    e.target.value = "";
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={alElegir} />
        <button type="button" onClick={() => input.current?.click()} disabled={pendiente} className="btn-sec">
          {pendiente ? t("Guardando…") : tieneImagen ? t("Cambiar foto") : t("Subir foto")}
        </button>
        {tieneImagen && (
          <button type="button" onClick={() => enviar({ quitar: "1" })} disabled={pendiente} className="btn-peligro">
            {t("Quitar")}
          </button>
        )}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim()) enviar({ url: url.trim() });
        }}
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("…o pega el enlace de una imagen")}
          className="campo"
          aria-label={t("Enlace de la imagen")}
        />
        <button className="btn-sec" disabled={pendiente || !url.trim()}>
          {t("Importar")}
        </button>
      </form>
      {estado?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{estado.error}</p>}
      {estado?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{estado.ok}</p>}
    </div>
  );
}
