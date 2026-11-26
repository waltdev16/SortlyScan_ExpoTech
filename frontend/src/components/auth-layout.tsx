import Image from "next/image";
import Link from "next/link";

/** Marco común de las páginas de acceso: marca a la izquierda, formulario claro a la derecha. */
export function AuthLayout({ eyebrow, title, intro, children, aside, wide = false }: {
  eyebrow: string; title: string; intro?: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className={`auth-shell${wide ? " is-wide" : ""}`}>
      <aside className="auth-brand">
        <Link href="/" aria-label="SortlyScan, volver al inicio">
          <Image src="/brand/logo-light-480.webp" width={480} height={149} alt="SortlyScan" priority />
        </Link>
        <p className="auth-brand-line">Aprender a reciclar.<br /><span>Cambiar el futuro.</span></p>
        <p className="auth-brand-note">Educación ambiental para escuelas de El Salvador.</p>
      </aside>
      <main id="contenido" className="auth-main">
        <div className="auth-card">
          <p className="ui-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {intro && <div className="ui-lead">{intro}</div>}
          {children}
        </div>
        {aside && <div className="auth-aside">{aside}</div>}
      </main>
    </div>
  );
}
