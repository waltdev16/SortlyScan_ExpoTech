"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** Redirección en el navegador (funciona también en la exportación estática, sin servidor). */
export function ClientRedirect({ to, label }: { to: string | (() => string); label: string }) {
  const router = useRouter();
  const target = typeof to === "string" ? to : null;
  useEffect(() => {
    router.replace(typeof to === "string" ? to : to());
  }, [router, to]);
  return (
    <main id="contenido" className="auth-page">
      <p>
        Redirigiendo… <Link className="ui-link" href={target ?? "/acceso"}>{label}</Link>
      </p>
    </main>
  );
}
