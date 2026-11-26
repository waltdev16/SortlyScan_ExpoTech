import type { MetadataRoute } from "next";

// Aplicación instalable ligera. Sin datos privados en caché: ver public/sw.js.
export const dynamic = "force-static";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SortlyScan Interactive Demo",
    short_name: "SortlyScan Interactive Demo",
    description: "Educación ambiental para escuelas de El Salvador.",
    lang: "es",
    start_url: `${BASE}/acceso`,
    scope: `${BASE}/`,
    display: "standalone",
    background_color: "#101410",
    theme_color: "#101410",
    icons: [
      { src: `${BASE}/brand/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${BASE}/brand/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
  };
}
