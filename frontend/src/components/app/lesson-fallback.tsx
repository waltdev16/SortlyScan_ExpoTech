"use client";
import { DemoPanel } from "./demo-provider";
import { StudentApp } from "./student";

/** Lección abierta desde la página 404 de un hosting estático (ver app/not-found.tsx). */
export function LessonFallback({ slug }: { slug: string }) {
  return (
    <DemoPanel role="student">
      <StudentApp section={["aprender", slug]} query={{}} />
    </DemoPanel>
  );
}
