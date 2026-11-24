import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { NOMBRE_APP } from "@/components/marca";
import { Preferencias } from "@/components/preferencias";
import { idiomaActual, temaActual, traductor } from "@/lib/i18n/servidor";
import { COLOR_BARRA } from "@/lib/preferencias";
import "./globals.css";

// Public Sans (licencia OFL, ver fonts/OFL-PublicSans.txt)
const publicSans = localFont({
  src: "./fonts/PublicSans-variable.ttf",
  variable: "--font-public-sans",
  weight: "100 900",
  display: "swap",
});

// Cormorant Garamond (licencia OFL, ver fonts/OFL-CormorantGaramond.txt): logotipo y títulos
const cormorant = localFont({
  src: [
    { path: "./fonts/CormorantGaramond-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/CormorantGaramond-600-italic.woff2", weight: "600", style: "italic" },
  ],
  variable: "--font-cormorant",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await traductor();
  return {
    title: { default: NOMBRE_APP, template: `%s · ${NOMBRE_APP}` },
    description: t("Control de compras, ventas y stock"),
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: NOMBRE_APP, statusBarStyle: "default" },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const tema = await temaActual();
  return {
    width: "device-width",
    initialScale: 1,
    themeColor:
      tema === "sistema"
        ? [
            { media: "(prefers-color-scheme: light)", color: COLOR_BARRA.claro },
            { media: "(prefers-color-scheme: dark)", color: COLOR_BARRA.oscuro },
          ]
        : COLOR_BARRA[tema],
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [idioma, tema] = await Promise.all([idiomaActual(), temaActual()]);
  return (
    // El tema sale de la cookie: el servidor ya pinta el correcto y no hay destello al cargar
    <html lang={idioma} data-tema={tema === "sistema" ? undefined : tema} className={`${publicSans.variable} ${cormorant.variable}`}>
      <body>
        <Preferencias idioma={idioma} tema={tema}>
          {children}
        </Preferencias>
      </body>
    </html>
  );
}
