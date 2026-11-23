import Link from "next/link";

export default function NoEncontrado() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-semibold">No encontrado</h1>
      <p className="mt-2 text-sm text-zinc-500">Esa página no existe o se ha borrado.</p>
      <Link href="/" className="btn mt-6">
        Volver al inicio
      </Link>
    </div>
  );
}
