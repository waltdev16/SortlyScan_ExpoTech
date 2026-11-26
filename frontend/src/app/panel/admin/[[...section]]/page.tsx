import { Suspense } from "react";
import Page from "@/components/app/pages/admin";
import { panelParams } from "@/components/app/pages/routes";

export function generateStaticParams() {
  return panelParams("admin");
}

export default function Route() {
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
}
