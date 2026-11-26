import type { Metadata } from "next";
import { ClientRedirect } from "@/components/client-redirect";

export const metadata: Metadata = { title: "Probar demostración · SortlyScan Interactive Demo", robots: { index: false } };

/** En la demostración no hay registro de cuentas: se elige un perfil ficticio. */
export default function RegisterPage() {
  return <ClientRedirect to="/acceso" label="Ir al selector de perfiles" />;
}
