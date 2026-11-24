// PolAr Vapes: de Pol y Arnau. Ruta «Sello»: logotipo en Cormorant Garamond con «Vapes» en versalitas espaciadas.
// Los archivos del logo (sello, monograma, logotipo) están en docs/marca/logo.
export const NOMBRE_APP = "PolAr Vapes";

export function Logotipo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-semibold ${className}`}>
      PolAr <span className="text-[.46em] tracking-[.16em]">VAPES</span>
    </span>
  );
}
