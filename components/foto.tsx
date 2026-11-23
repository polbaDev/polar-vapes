// Imagen de producto/sabor con fondo suave del color dominante y respaldo si no hay foto.

function tinte(color: string | null | undefined) {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return undefined;
  return `${color}22`; // ~13 % de opacidad
}

export function Foto({
  id,
  color,
  alt,
  className = "",
  ajuste = "contain",
  texto,
}: {
  id: number | null | undefined;
  color?: string | null;
  alt: string;
  className?: string;
  ajuste?: "contain" | "cover";
  texto?: string;
}) {
  if (!id) {
    const iniciales = (texto ?? alt)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("");
    return (
      <div
        className={`flex items-center justify-center overflow-hidden bg-zinc-100 text-zinc-400 ${className}`}
        role="img"
        aria-label={alt}
      >
        <span className="select-none text-sm font-semibold tracking-wide">{iniciales || "—"}</span>
      </div>
    );
  }
  return (
    <div className={`overflow-hidden ${className}`} style={{ backgroundColor: tinte(color) ?? "#f4f4f5" }}>
      <img
        src={`/img/${id}`}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`h-full w-full ${ajuste === "cover" ? "object-cover" : "object-contain"}`}
      />
    </div>
  );
}
