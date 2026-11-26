// Las imágenes son archivos ya optimizados (WebP/PNG en /public): se sirven tal cual, con el prefijo
// de la subcarpeta cuando la demo se publica en una ruta como https://usuario.github.io/repositorio.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }) {
  void width;
  return src.startsWith("/") && !src.startsWith(`${BASE}/`) ? `${BASE}${src}` : src;
}
