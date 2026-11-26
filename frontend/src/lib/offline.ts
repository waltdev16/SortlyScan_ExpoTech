/**
 * Conectividad limitada (fase 9).
 *
 * - Borradores: las respuestas de un cuestionario o evaluación en curso se guardan en sessionStorage,
 *   separadas por usuario. Si la página se recarga o la red se corta, no se pierden. Se borran al
 *   enviar con éxito, al cerrar la pestaña y al cerrar sesión. Solo contienen lo que el estudiante
 *   eligió (nunca respuestas correctas, que no llegan al navegador).
 * - Reenvío seguro: cada envío lleva una clave de idempotencia guardada con el borrador; si la primera
 *   solicitud sí llegó al servidor, el reenvío no duplica puntos.
 * - El service worker (public/sw.js) solo guarda contenido público: la guía sin conexión, imágenes de
 *   marca y archivos estáticos de la aplicación. Nunca respuestas de la API ni páginas privadas.
 */

const PREFIX = "ss-draft:";

export function draftKey(userId: string, scope: string) {
  return `${PREFIX}${userId}:${scope}`;
}

export function loadDraft<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveDraft(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* almacenamiento lleno o bloqueado: se sigue sin borrador */
  }
}

export function clearDraft(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* sin acceso al almacenamiento */
  }
}

/** Al cerrar sesión: borra borradores y cualquier dato privado guardado en este navegador. */
export async function clearPrivateData() {
  try {
    for (const store of [sessionStorage, localStorage]) {
      for (const key of Object.keys(store)) if (key.startsWith(PREFIX) || key.startsWith("ss-private:")) store.removeItem(key);
    }
  } catch {
    /* sin acceso al almacenamiento */
  }
  try {
    if ("caches" in window) {
      for (const name of await caches.keys()) if (name.startsWith("sortlyscan-private")) await caches.delete(name);
    }
  } catch {
    /* Cache Storage no disponible */
  }
}
