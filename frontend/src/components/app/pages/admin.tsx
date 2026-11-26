"use client";
import { AdminApp } from "../admin";
import { useSection } from "./shared";

export default function AdminPage() {
  return <AdminApp section={useSection()} />;
}
