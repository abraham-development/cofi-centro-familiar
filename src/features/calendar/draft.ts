import { z } from "zod";

import { eventFormSchema } from "./schemas";

/**
 * Borrador que la ventana rápida de la agenda entrega al formulario completo
 * («Más opciones»). Va por `sessionStorage` y no por la URL, para que el
 * título no quede en historiales ni registros del servidor.
 */
const DRAFT_KEY = "cofi-agenda-borrador";

const { title, endTime, participantIds, reminderOffsets } = eventFormSchema.shape;
const draftSchema = z.object({ title, endTime, participantIds, reminderOffsets });

export type AgendaDraft = z.infer<typeof draftSchema>;

export function saveAgendaDraft(draft: AgendaDraft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Sin almacenamiento (modo privado): el formulario abre sin el borrador.
  }
}

/** Lee y borra el borrador; devuelve `null` si no hay uno válido. */
export function takeAgendaDraft(): AgendaDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    sessionStorage.removeItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = draftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
