import type { NextConfig } from "next";

// SortlyScan Interactive Demo: no hay API, Supabase ni variables de entorno obligatorias.
// Todo ocurre en el navegador: datos ficticios en localStorage y Vision con ONNX Runtime Web.
//
// Exportación estática (GitHub Pages u otro hosting de archivos): `npm run build:static`
// define STATIC_EXPORT=1 y, si se publica en una subcarpeta (https://usuario.github.io/repositorio),
// BASE_PATH=/repositorio. Ver docs/DESPLIEGUE_DEMO.md.
const isDev = process.env.NODE_ENV !== "production";
const staticExport = process.env.STATIC_EXPORT === "1";
const basePath = (process.env.BASE_PATH ?? "").replace(/\/$/, "");

// Content Security Policy: solo este mismo sitio. 'wasm-unsafe-eval' permite compilar el WebAssembly
// de ONNX Runtime (no habilita eval de JavaScript). 'unsafe-inline' en scripts: Next.js inserta scripts
// en línea para hidratar páginas estáticas.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // La cámara solo se permite en este mismo origen (escáner).
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  // Los navegadores ignoran HSTS en http://localhost; en Vercel el sitio siempre es HTTPS.
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const config: NextConfig = {
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // Imágenes ya optimizadas en /public; el cargador solo agrega la subcarpeta (BASE_PATH) si existe.
  images: { loader: "custom", loaderFile: "./src/lib/image-loader.ts" },
  devIndicators: false,
  poweredByHeader: false,
  ...(staticExport ? { output: "export" as const, trailingSlash: true, basePath: basePath || undefined } : {}),
  // Las cabeceras solo existen con un servidor (Vercel, `next start`). En exportación estática las
  // define el hosting; ver docs/DESPLIEGUE_DEMO.md.
  ...(staticExport
    ? {}
    : {
      async headers() {
        return [
          { source: "/:path*", headers: securityHeaders },
          { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] },
          // Modelo y motor de IA: grandes y versionados por nombre; se guardan una semana en caché.
          { source: "/vision/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800" }] },
        ];
      },
    }),
};
export default config;
