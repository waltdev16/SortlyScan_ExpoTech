import type { DemoRole } from "@/lib/demo/db";
import { DemoPanel } from "./demo-provider";

/** Panel de la demostración interactiva: datos ficticios guardados en este navegador. */
export function Panel({ role, children }: { role: DemoRole; children: React.ReactNode }) {
  return <DemoPanel role={role}>{children}</DemoPanel>;
}
