import type { Metadata } from "next";
import Link from "next/link";
import { AuthLayout } from "@/components/auth-layout";
import { InstitutionForm } from "@/components/institution-form";

export const metadata: Metadata = { title: "Solicitar registro institucional · SortlyScan" };

export default function ApplicationPage() {
  return (
    <AuthLayout eyebrow="Registro institucional" title="El cambio empieza en tu escuela."
      aside={<p><Link className="ui-link" href="/">Volver al inicio</Link></p>}>
      <div className="auth-form-legacy">
        <InstitutionForm />
      </div>
    </AuthLayout>
  );
}
