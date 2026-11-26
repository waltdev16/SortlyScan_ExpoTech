"use client";
import { ClientRedirect } from "@/components/client-redirect";
import { getActor } from "@/lib/demo/db";
import { homeOf } from "@/lib/demo/profiles";

const target = () => {
  const actor = getActor();
  return actor ? homeOf(actor.role) : "/acceso";
};

/** Lleva al panel del último perfil usado en esta pestaña o al selector de perfiles. */
export default function PanelHome() {
  return <ClientRedirect to={target} label="Ir al selector de perfiles" />;
}
