"use client";
import { StudentApp } from "../student";
import { useQuery, useSection } from "./shared";

export default function StudentPage() {
  const q = useQuery();
  return <StudentApp section={useSection()} query={{ actividad: q.actividad }} />;
}
