import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { ProfilePicker } from "@/components/profile-picker";

export const metadata: Metadata = { title: "Explorar plataforma · SortlyScan Interactive Demo" };

/** Selector de perfiles: en la demostración interactiva no hay cuentas ni contraseñas. */
export default function AccessPage() {
  return (
    <AuthLayout
      wide
      eyebrow="SortlyScan Interactive Demo"
      title="Tu espacio para aprender."
      intro={<p>Explora cómo SortlyScan transforma la educación ambiental desde diferentes perspectivas.</p>}
    >
      <Suspense fallback={<div className="profile-grid" aria-busy="true" />}>
        <ProfilePicker />
      </Suspense>
    </AuthLayout>
  );
}
