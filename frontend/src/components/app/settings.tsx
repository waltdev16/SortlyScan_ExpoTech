"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ResetDemoButton, StorageNote } from "../demo-controls";
import { useAction, usePanel } from "./api-context";
import { MyPrivacy } from "./school";
import { ErrorState, Field, Notice, PageHeader, Section } from "./ui";

export function AccountSettings({ embedded = false }: { embedded?: boolean }) {
  const { me, role } = usePanel();
  const router = useRouter();
  const [name, setName] = useState(me.displayName);
  const [saved, setSaved] = useState("");
  const profile = useAction();
  const managed = me.accountType === "managed_student";

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSaved("");
    if (!name.trim()) return profile.setError(null);
    const ok = await profile.run((api) => api.updateMe(name.trim()));
    if (ok) setSaved("Nombre actualizado en esta demostración.");
  }

  return (
    <>
      {!embedded && <PageHeader eyebrow="Configuración" title="Tu cuenta." />}
      <Notice>Perfil ficticio de demostración: no hay contraseñas ni sesiones. Para usar otro perfil, elige «Cambiar perfil» en el menú.</Notice>
      <Section title="Perfil">
        {managed ? (
          <div className="ui-definition">
            <p><span>Nombre visible</span>{me.displayName}</p>
            <p><span>Usuario</span><code>{me.username}</code></p>
            <p className="ui-muted ui-small">Tu docente administra tu cuenta.</p>
          </div>
        ) : (
          <form className="ui-form ui-form-narrow" onSubmit={saveName}>
            <Field label="Nombre visible" hint="Así te verán en tu institución.">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoComplete="name" />
            </Field>
            {me.email && <p className="ui-small ui-muted">Correo: {me.email}</p>}
            <ErrorState error={profile.error} />
            {saved && <p className="ui-success" role="status">{saved}</p>}
            <button className="ui-button ui-button-dark" disabled={profile.pending}>Guardar</button>
          </form>
        )}
      </Section>
      {role !== "director" && role !== "admin" && <MyPrivacy />}
      <Section title="Esta demostración">
        <StorageNote />
        <div className="ui-form-actions">
          <ResetDemoButton onDone={() => router.push("/acceso")} />
        </div>
      </Section>
    </>
  );
}
