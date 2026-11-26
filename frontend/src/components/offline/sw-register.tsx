"use client";
import { useEffect } from "react";

/** Registra el service worker (solo en producción). Ver public/sw.js: guarda únicamente contenido público. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    // En una subcarpeta (BASE_PATH) el service worker no aplica: sus rutas suponen la raíz del sitio.
    if (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_BASE_PATH || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* sin service worker: la aplicación funciona igual, sin guía sin conexión */
    });
  }, []);
  return null;
}
