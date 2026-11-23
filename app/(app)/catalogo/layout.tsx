import { TabsCatalogo } from "@/components/tabs-catalogo";

export default function CatalogoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TabsCatalogo />
      {children}
    </>
  );
}
