"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

/** Aviso visible cuando el navegador pierde la conexión. No simula funciones que necesitan internet. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div className="offline-banner" role="status">
      <strong>Sin conexión.</strong> Lo que tienes en pantalla se conserva; envíalo cuando vuelva la conexión. Las lecciones con
      puntos, el escáner y los reportes necesitan internet. <Link href="/guia">Abrir la guía sin conexión</Link>
    </div>
  );
}
