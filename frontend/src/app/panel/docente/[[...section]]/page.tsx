import { Suspense } from "react";
import Page from "@/components/app/pages/teacher";
import { panelParams } from "@/components/app/pages/routes";

export function generateStaticParams() {
  return panelParams("docente");
}

export default function Route() {
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
}
