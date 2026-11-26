import type { Metadata } from "next";
import { ClientRedirect } from "@/components/client-redirect";

export const metadata: Metadata = { title: "Explorar plataforma · SortlyScan Interactive Demo", robots: { index: false } };

/** Ruta antigua del modo demostración: ahora todo empieza en el selector de perfiles. */
export default function DemoPage() {
  return <ClientRedirect to="/acceso" label="Ir al selector de perfiles" />;
}
