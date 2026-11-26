"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import type { ApplicationInput } from "@/lib/api/types";
import { submitLocalApplication } from "@/lib/demo/applications";

export const DEPARTMENTS = [
  "Ahuachapán", "Santa Ana", "Sonsonate", "Chalatenango", "La Libertad", "San Salvador", "Cuscatlán",
  "La Paz", "Cabañas", "San Vicente", "Usulután", "San Miguel", "Morazán", "La Unión",
];
const TYPES: [ApplicationInput["institution_type"], string][] = [
  ["public", "Pública"], ["private", "Privada"], ["subsidized", "Subvencionada"], ["other", "Otra"],
];
type Errors = Partial<Record<keyof ApplicationInput, string>>;

function validate(d: ApplicationInput): Errors {
  const e: Errors = {};
  const len = (v: string | null | undefined, min: number, max: number) => (v ?? "").trim().length >= min && (v ?? "").trim().length <= max;
  if (!len(d.institution_name, 3, 160)) e.institution_name = "Escribe el nombre completo (3 a 160 caracteres).";
  if (d.official_code && !/^[A-Za-z0-9-]{3,20}$/.test(d.official_code)) e.official_code = "Usa solo letras, números y guiones.";
  if (!DEPARTMENTS.includes(d.department)) e.department = "Elige un departamento.";
  if (!len(d.district, 2, 80)) e.district = "Escribe el distrito.";
  if (!len(d.representative_name, 3, 120)) e.representative_name = "Escribe el nombre de la persona representante.";
  if (!len(d.representative_position, 2, 80)) e.representative_position = "Indica su cargo.";
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) e.email = "Escribe un correo válido o déjalo vacío.";
  if (d.phone && !/^[0-9+() -]{7,20}$/.test(d.phone)) e.phone = "Usa solo números, espacios, guiones o +.";
  if ((d.message ?? "").length > 1000) e.message = "Máximo 1000 caracteres.";
  if (!d.accepts_privacy) e.accepts_privacy = "Confirma que entiendes que es una solicitud ficticia.";
  return e;
}

/**
 * Solicitud institucional de la DEMOSTRACIÓN: se guarda solo en este navegador como solicitud ficticia
 * pendiente, para revisarla desde el perfil de superadministración. No se envía a SortlyScan.
 */
export function InstitutionForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<"idle" | "sent">("idle");
  const [failure, setFailure] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);
    const f = new FormData(event.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "").trim();
    const data: ApplicationInput = {
      institution_name: s("institution_name"), official_code: s("official_code") || null, department: s("department"),
      district: s("district"), institution_type: s("institution_type") as ApplicationInput["institution_type"],
      representative_name: s("representative_name"), representative_position: s("representative_position"),
      email: s("email").toLowerCase(), phone: s("phone") || null, message: s("message") || null,
      accepts_privacy: f.get("accepts_privacy") === "on", website: s("website"),
    };
    const found = validate(data);
    setErrors(found);
    if (Object.keys(found).length) {
      event.currentTarget.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }
    try {
      submitLocalApplication(data);
      setState("sent");
    } catch {
      setFailure("No se pudo guardar la solicitud ficticia en este navegador (el almacenamiento puede estar bloqueado).");
    }
  }

  if (state === "sent") {
    return (
      <div className="form-result" role="status">
        <p className="form-result-title">Solicitud ficticia guardada.</p>
        <p>
          Quedó como <strong>pendiente</strong> solo en este navegador. <strong>No se envió a SortlyScan</strong> ni a ninguna persona: es
          parte de la demostración. Para revisarla, entra como superadministración y apruébala; su dirección aparecerá en el selector de perfiles.
        </p>
        <p><Link className="ui-link" href="/acceso?rol=admin">Revisar como superadministración</Link></p>
      </div>
    );
  }

  const field = (name: keyof ApplicationInput) => ({
    name,
    id: `inst-${name}`,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `inst-${name}-error` : undefined,
  });
  const error = (name: keyof ApplicationInput) =>
    errors[name] ? <span className="form-error" id={`inst-${name}-error`}>{errors[name]}</span> : null;

  return (
    <>
      <p>
        <strong>Demostración:</strong> esta solicitud es ficticia y se guarda solo en este navegador. No se envía a SortlyScan, no reserva
        un cupo en el programa piloto y nadie la recibirá. Usa datos inventados y no incluyas datos de estudiantes.
      </p>
      <form onSubmit={submit} className="institution-form" noValidate>
        <label htmlFor="inst-institution_name">
          Nombre de la institución
          <input {...field("institution_name")} maxLength={160} autoComplete="organization" placeholder="Centro Escolar…" />
          {error("institution_name")}
        </label>
        <div className="form-row">
          <label htmlFor="inst-official_code">
            Código institucional <span className="form-optional">(si aplica)</span>
            <input {...field("official_code")} maxLength={20} inputMode="text" />
            {error("official_code")}
          </label>
          <label htmlFor="inst-institution_type">
            Tipo de institución
            <select {...field("institution_type")} defaultValue="public">
              {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label htmlFor="inst-department">
            Departamento
            <select {...field("department")} defaultValue="">
              <option value="" disabled>Elige uno</option>
              {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
            </select>
            {error("department")}
          </label>
          <label htmlFor="inst-district">
            Distrito
            <input {...field("district")} maxLength={80} autoComplete="address-level2" />
            {error("district")}
          </label>
        </div>
        <div className="form-row">
          <label htmlFor="inst-representative_name">
            Nombre del representante
            <input {...field("representative_name")} maxLength={120} autoComplete="name" />
            {error("representative_name")}
          </label>
          <label htmlFor="inst-representative_position">
            Cargo
            <input {...field("representative_position")} maxLength={80} placeholder="Director/a, subdirector/a…" />
            {error("representative_position")}
          </label>
        </div>
        <div className="form-row">
          <label htmlFor="inst-email">
            Correo de contacto <span className="form-optional">(ficticio, opcional)</span>
            <input {...field("email")} type="email" maxLength={254} autoComplete="off" placeholder="direccion@ejemplo.invalid" />
            {error("email")}
          </label>
          <label htmlFor="inst-phone">
            Teléfono de contacto <span className="form-optional">(opcional)</span>
            <input {...field("phone")} type="tel" maxLength={20} autoComplete="off" />
            {error("phone")}
          </label>
        </div>
        <label htmlFor="inst-message">
          Mensaje <span className="form-optional">(opcional)</span>
          <textarea {...field("message")} rows={3} maxLength={1000} />
          {error("message")}
        </label>
        <label className="form-honeypot" aria-hidden="true">
          Sitio web
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
        <label className="form-check" htmlFor="inst-accepts_privacy">
          <input {...field("accepts_privacy")} type="checkbox" />
          <span>Entiendo que es una solicitud ficticia de demostración, guardada solo en este navegador y que no se envía a SortlyScan.</span>
        </label>
        {error("accepts_privacy")}
        {failure && <div className="form-failure" role="alert"><p>{failure}</p></div>}
        <button className="button button-dark" type="submit">
          Guardar solicitud ficticia <ArrowRight size={17} />
        </button>
        <p className="form-note">
          ¿Solo quieres conocer la plataforma? <Link href="/acceso">Explora los perfiles</Link> de la institución piloto ficticia.
        </p>
      </form>
    </>
  );
}
