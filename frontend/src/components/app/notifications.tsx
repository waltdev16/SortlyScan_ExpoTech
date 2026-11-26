"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import type { NotificationList } from "@/lib/api/types";
import { usePanel } from "./api-context";
import { SidePanel } from "./overlay";

const when = (iso: string) => new Date(iso).toLocaleDateString("es-SV", { day: "numeric", month: "short" });

/**
 * Avisos internos discretos: se consultan al abrir el panel y al cambiar de sección (sin sondeo
 * continuo, sin sonidos, sin correos). El contador desaparece cuando todo está leído.
 */
export function NotificationBell() {
  const { api, role, base } = usePanel();
  const pathname = usePathname();
  const [data, setData] = useState<NotificationList | null>(null);
  const [open, setOpen] = useState(false);
  const load = useCallback(() => {
    api.notifications().then(setData).catch(() => setData(null));
  }, [api]);
  useEffect(() => {
    if (role !== "admin") load();
  }, [load, pathname, role]);
  if (role === "admin" || !data) return null;

  const href = (link: string | null) => link ?? base;
  async function markAll() {
    setData(await api.readNotifications());
  }
  return (
    <>
      <button
        type="button"
        className="nt-bell"
        onClick={() => setOpen(true)}
        aria-label={data.unread ? `Notificaciones, ${data.unread} sin leer` : "Notificaciones"}
      >
        <Bell size={18} aria-hidden />
        {data.unread > 0 && <span className="nt-count" aria-hidden="true">{data.unread > 9 ? "9+" : data.unread}</span>}
      </button>
      <SidePanel open={open} onClose={() => setOpen(false)} title="Notificaciones"
        description="Avisos sobre actividades, retos, revisiones y logros. No se envían correos.">
        {data.items.length === 0 ? (
          <p className="nt-empty">No tienes notificaciones.</p>
        ) : (
          <>
            {data.unread > 0 && (
              <button type="button" className="ui-button ui-button-quiet ui-button-small nt-markall" onClick={markAll}>
                Marcar todo como leído
              </button>
            )}
            <ul className="nt-list">
              {data.items.map((n) => (
                <li key={n.id} className={n.read ? "is-read" : undefined}>
                  <Link href={href(n.link)} onClick={() => { setOpen(false); if (!n.read) api.readNotifications(n.id).then(setData).catch(() => { }); }}>
                    <strong>{n.title}</strong>
                    {n.body && <span>{n.body}</span>}
                    <time dateTime={n.created_at}>{when(n.created_at)}{!n.read && <span className="sr-only"> · sin leer</span>}</time>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </SidePanel>
    </>
  );
}
