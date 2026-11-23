import { Tpv } from "@/components/tpv";
import { variantesLigeras } from "@/lib/ligeras";

export const metadata = { title: "Vender · Gestión Vapers" };

export default async function NuevaVenta() {
  const variantes = await variantesLigeras();
  return <Tpv variantes={variantes} />;
}
