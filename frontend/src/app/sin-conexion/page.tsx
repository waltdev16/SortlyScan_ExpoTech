import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Sin conexión · SortlyScan" };

/** Página que muestra el service worker cuando una sección necesita internet y no hay conexión. */
export default function OfflinePage() {
  return (
    <main id="contenido" className="not-found">
      <p className="eyebrow">SORTLYSCAN / SIN CONEXIÓN</p>
      <h1>Esta sección necesita internet.</h1>
      <p>
        Los paneles, las lecciones con puntos, el escáner y los reportes funcionan solo con conexión. Mientras tanto puedes leer la
        guía de separación.
      </p>
      <Link href="/guia" className="button button-lime">Abrir la guía sin conexión</Link>
    </main>
  );
}
