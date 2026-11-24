// Se vuelve a montar en cada navegación: la pantalla entra con un pequeño fundido (ver .entra en globals.css)
export default function Plantilla({ children }: { children: React.ReactNode }) {
  return <div className="entra">{children}</div>;
}
