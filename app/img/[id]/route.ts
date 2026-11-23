import { leerImagen } from "@/lib/imagenes";

// Sirve las imágenes guardadas en la base de datos.
// Cada imagen nueva tiene un id nuevo, así que se pueden cachear para siempre.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("No encontrada", { status: 404 });
  const img = await leerImagen(id);
  if (!img) return new Response("No encontrada", { status: 404 });
  return new Response(new Uint8Array(img.datos), {
    headers: {
      "Content-Type": img.tipo,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
