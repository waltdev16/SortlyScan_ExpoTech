"use client";
import { DirectorApp } from "../director";
import { useQuery, useSection } from "./shared";

export default function DirectorPage() {
  return <DirectorApp section={useSection()} query={useQuery()} />;
}
