"use client";
import { TeacherApp } from "../staff";
import { useQuery, useSection } from "./shared";

export default function TeacherPage() {
  return <TeacherApp section={useSection()} query={useQuery()} />;
}
