import type { Metadata } from "next";
import { Panel } from "@/components/app/panel-layout";

export const metadata: Metadata = { title: "Panel · SortlyScan Interactive Demo", robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <Panel role="student">{children}</Panel>;
}
