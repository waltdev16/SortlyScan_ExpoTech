"use client";
// Rutas de los paneles para navegación local y estática.
import { useParams, useSearchParams } from "next/navigation";

export function useSection(): string[] {
  const params = useParams<{ section?: string[] }>();
  return (params?.section ?? []).map((s) => decodeURIComponent(s));
}

export function useQuery(): Record<string, string | undefined> {
  const search = useSearchParams();
  return Object.fromEntries([...(search?.entries() ?? [])]);
}
