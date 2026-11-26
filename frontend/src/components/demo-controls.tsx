"use client";
import { useEffect, useRef, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { resetDemo, storedBytes } from "@/lib/demo/db";

/** Aviso fijo sobre dónde viven los datos de la demostración. */
export function StorageNote({ compact = false }: { compact?: boolean }) {
  const [kb, setKb] = useState<number | null>(null);
  useEffect(() => setKb(Math.round(storedBytes() / 1024)), []);
  return (
    <p className={`demo-storage-note${compact ? " is-compact" : ""}`}>
      <strong>Datos ficticios guardados solo en este navegador.</strong> No se envían a ningún servidor, no se comparten entre
      dispositivos y no son seguros: cualquiera con acceso a este navegador puede verlos o borrarlos.
      {kb !== null && kb > 0 && !compact && <> Ocupan unos {kb} KB.</>}
    </p>
  );
}

/** «Restablecer demostración»: borra todo lo hecho en este navegador después de confirmar. */
export function ResetDemoButton({ className = "ui-button ui-button-quiet", onDone, label = "Restablecer demostración" }: {
  className?: string; onDone?: () => void; label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <RotateCcw size={16} aria-hidden /> {label}
      </button>
      {open && (
        <ConfirmDialog
          title="¿Restablecer la demostración?"
          confirmLabel="Sí, restablecer"
          onCancel={() => setOpen(false)}
          onConfirm={() => {
            resetDemo();
            setOpen(false);
            onDone?.();
          }}
        >
          <p>
            Se borrarán en este navegador todos los cambios: estudiantes, grupos e instituciones creadas, actividades, puntos,
            retos, solicitudes y reportes. La demostración volverá a sus datos ficticios iniciales.
          </p>
          <p>Esta acción no se puede deshacer y no afecta ninguna base de datos externa.</p>
        </ConfirmDialog>
      )}
    </>
  );
}

export function ConfirmDialog({ title, children, confirmLabel, onConfirm, onCancel }: {
  title: string; children: React.ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog ref={ref} className="confirm-dialog" aria-labelledby="confirm-title" aria-describedby="confirm-body" onCancel={(e) => { e.preventDefault(); onCancel(); }}>
      <div className="confirm-dialog-inner">
        <button type="button" className="confirm-close" onClick={onCancel} aria-label="Cerrar"><X size={20} aria-hidden /></button>
        <h2 id="confirm-title">{title}</h2>
        <div id="confirm-body" className="confirm-body">{children}</div>
        <div className="ui-form-actions">
          <button type="button" className="ui-button ui-button-dark ui-danger-solid" onClick={onConfirm}>{confirmLabel}</button>
          <button type="button" className="ui-button ui-button-quiet" onClick={onCancel} autoFocus>Cancelar</button>
        </div>
      </div>
    </dialog>
  );
}
