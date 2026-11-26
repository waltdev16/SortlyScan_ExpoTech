import type { Metadata } from "next";
import Link from "next/link";
import { AuthLayout } from "@/components/auth-layout";
import { VisionLab } from "./vision-lab";

export const metadata: Metadata = { title: "Cómo funciona SortlyScan Vision" };

export default function VisionPage() {
  return (
    <AuthLayout
      eyebrow="SortlyScan Vision"
      title="Inteligencia artificial real, en tu navegador."
      intro={
        <p>
          Un modelo MobileNetV3-Small entrenado con fotos de residuos clasifica la imagen directamente en este dispositivo con
          ONNX Runtime Web. Usa el mismo preprocesamiento, el mismo orden de categorías y los mismos umbrales que el servidor del
          proyecto completo. Si no está seguro, responde «No identificado». No reconoce residuos orgánicos.
        </p>
      }
      aside={<p>¿Quieres usarlo como estudiante? <Link className="ui-link" href="/acceso">Explora la plataforma</Link>.</p>}
    >
      <VisionLab />
    </AuthLayout>
  );
}
