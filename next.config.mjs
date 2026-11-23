/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // sharp se usa en el servidor para procesar imágenes
  serverExternalPackages: ["sharp"],
  experimental: {
    // Las fotos se reducen en el navegador antes de subirlas; esto deja margen
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
