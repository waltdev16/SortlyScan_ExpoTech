"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// En la exportación estática (GitHub Pages) una lección creada durante la demostración no tiene página
// propia: el hosting entrega esta página 404 y aquí se abre la lección en el panel del estudiante.
const LessonFallback = dynamic(() => import("@/components/app/lesson-fallback").then((m) => m.LessonFallback), { ssr: false });
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function NotFound() {
  const [lesson, setLesson] = useState<string | null>(null);
  useEffect(() => {
    const path = window.location.pathname.slice(BASE.length);
    const match = path.match(/^\/panel\/estudiante\/aprender\/([^/]+)\/?$/);
    if (match) setLesson(decodeURIComponent(match[1]));
  }, []);
  if (lesson) return <LessonFallback slug={lesson} />;
  return (
    <main className="not-found">
      <p className="eyebrow">SORTLYSCAN / 404</p>
      <h1>
        Este camino
        <br />
        aún no existe.
      </h1>
      <p>Vuelve al inicio para seguir explorando.</p>
      <a href={`${BASE}/`} className="button button-lime">
        Volver a SortlyScan
      </a>
    </main>
  );
}
