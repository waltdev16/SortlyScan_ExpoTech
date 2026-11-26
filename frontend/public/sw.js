/* SortlyScan · service worker ligero (fase 9).
 *
 * Guarda SOLO contenido público:
 *  - la guía de separación (/guia) y la página "sin conexión";
 *  - imágenes de marca y archivos estáticos de Next.js (/_next/static, inmutables y sin datos de nadie).
 * Nunca guarda respuestas de la API, páginas de /panel, /acceso ni nada con datos de una persona.
 * Sin conexión, una página que necesita internet muestra /sin-conexion en lugar de un error del navegador.
 */
const VERSION = "sortlyscan-public-v1";
const PRECACHE = ["/guia", "/sin-conexion", "/brand/logo-light-480.webp", "/brand/symbol-256.webp", "/brand/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n.startsWith("sortlyscan-public") && n !== VERSION).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

const isPublicStatic = (url) => url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/");

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // API y Supabase: nunca pasan por la caché

  if (isPublicStatic(url)) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })),
    );
    return;
  }

  if (request.mode === "navigate") {
    if (url.pathname === "/guia") {
      // Red primero (contenido actualizado); sin red, la copia guardada.
      event.respondWith(fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(VERSION).then((cache) => cache.put("/guia", copy));
        return response;
      }).catch(() => caches.match("/guia")));
      return;
    }
    // Resto de páginas: siempre de la red. Solo si falla, la página "sin conexión" (no se guarda nada privado).
    event.respondWith(fetch(request).catch(() => caches.match("/sin-conexion")));
  }
});
