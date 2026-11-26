import type { Metadata, Viewport } from "next";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/manrope";
import "@fontsource/ibm-plex-mono/400.css";
import "./globals.css";
import "./app-ui.css";
import { ServiceWorkerRegister } from "@/components/offline/sw-register";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "SortlyScan Interactive Demo — Aprender a reciclar. Cambiar el futuro.",
  description:
    "Educación ambiental que empieza en el aula. Conoce la propuesta de SortlyScan: aprendizaje, inteligencia artificial y participación para escuelas de El Salvador.",
  robots: { index: false, follow: false },
  icons: { icon: `${BASE}/brand/symbol-256.webp`, apple: `${BASE}/brand/icon-192.png` },
};
export const viewport: Viewport = { themeColor: "#101410" };
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
