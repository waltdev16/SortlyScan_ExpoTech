import { Suspense } from "react";
import Page from "@/components/app/pages/student";
import { panelParams } from "@/components/app/pages/routes";

export function generateStaticParams() {
  return panelParams("estudiante");
}

export default function Route() {
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
}
