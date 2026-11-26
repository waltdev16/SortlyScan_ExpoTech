import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import demoContent from "@/data/demo-content.json";

export const metadata: Metadata = { title: "Guía rápida de separación · SortlyScan" };

// Solo la teoría de cada lección (qué es, cómo identificarlo, cómo prepararlo y errores frecuentes).
// No incluye actividades, cuestionarios ni respuestas. El service worker la guarda para leerla sin conexión.
const GUIDES = demoContent.lessons.map((l) => ({ slug: l.slug, title: l.title, intro: l.intro, ...l.content }));

export default function GuidePage() {
  return (
    <div className="gd">
      <header className="gd-head">
        <Link href="/" aria-label="SortlyScan, inicio">
          <Image src="/brand/logo-light-480.webp" width={480} height={149} alt="SortlyScan" priority />
        </Link>
      </header>
      <main id="contenido" className="gd-main">
        <p className="ui-eyebrow">Disponible sin conexión</p>
        <h1>Guía rápida de separación</h1>
        <p className="gd-note">
          Esta guía se puede leer sin internet después de abrirla una vez. Las lecciones con actividades, los cuestionarios, los
          puntos, el escáner y los reportes necesitan conexión: SortlyScan no registra nada mientras estás sin internet.
        </p>
        <nav aria-label="Materiales" className="gd-toc">
          <ul>{GUIDES.map((g) => <li key={g.slug}><a href={`#${g.slug}`}>{g.title}</a></li>)}</ul>
        </nav>
        {GUIDES.map((g) => (
          <section key={g.slug} id={g.slug} className="gd-section" aria-labelledby={`${g.slug}-t`}>
            <h2 id={`${g.slug}-t`}>{g.title}</h2>
            {g.intro && <p>{g.intro}</p>}
            <p>{g.what}</p>
            <h3>Cómo identificarlo</h3>
            <ul>{g.identify.map((x) => <li key={x}>{x}</li>)}</ul>
            <h3>Cómo prepararlo</h3>
            <ol>{g.classify.map((x) => <li key={x}>{x}</li>)}</ol>
            <h3>Errores frecuentes</h3>
            <ul>{g.mistakes.map((x) => <li key={x}>{x}</li>)}</ul>
          </section>
        ))}
        <p className="gd-note">Las reglas finales las define el centro de acopio de tu comunidad. Si tienes dudas, consulta a tu docente.</p>
      </main>
    </div>
  );
}
