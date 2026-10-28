"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { CHILD_AVATARS, childWorldMember, type ChildAppearance } from "../appearance";
import { saveChildAppearanceAction } from "../appearance-actions";
import { ColorPicker } from "@/components/color-picker";
import { MemberAvatar } from "@/components/member-chip";
import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import type { MemberSummary } from "@/features/calendar/types";
import { useOnlineStatus } from "@/hooks/use-online-status";

export function ChildAppearanceForm({ member, appearance }: { member: MemberSummary; appearance: ChildAppearance }) {
  // Un aviso Realtime no pisa lo que el hijo está eligiendo.
  const [draft, setDraft] = useState<ChildAppearance | null>(null);
  const [saved, setSaved] = useState<{ value: ChildAppearance; source: ChildAppearance } | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const online = useOnlineStatus();
  const values = draft ?? (saved?.source === appearance ? saved.value : appearance);
  const preview = childWorldMember(member, values);
  return <Panel id="mi-apariencia" title="Así se ve mi mundo" caption="Tu color y avatar te acompañan en todas tus pantallas">
    <div className="flex items-center gap-4 rounded-xl bg-muted/50 p-4" aria-label="Vista previa de mi apariencia">
      <MemberAvatar member={preview} size="xl" />
      <div><p className="text-sm text-muted-foreground">Mi mundo</p><p className="text-xl font-semibold">{member.displayName}</p></div>
    </div>
    <form className="flex flex-col gap-5" onSubmit={(event) => {
      event.preventDefault();
      setError("");
      startTransition(async () => {
        try {
          const result = await saveChildAppearanceAction(values);
          if (!result.ok) { setError(result.error.message); return; }
          setSaved({ value: result.data, source: appearance }); setDraft(null);
          toast.success("Tu apariencia está guardada");
        } catch { setError("No se pudo guardar. Revisa tu conexión e inténtalo otra vez."); }
      });
    }}>
      <fieldset disabled={pending} className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-semibold">Mi color</legend>
        <ColorPicker value={preview.color} onChange={(accentColor) => { setSaved(null); setDraft({ ...values, accentColor }); }} label="Mi color" />
      </fieldset>
      <fieldset disabled={pending}>
        <legend className="mb-3 text-sm font-semibold">Mi avatar</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Mi avatar">
          {CHILD_AVATARS.map(({ key, label }) => <button key={key} type="button" role="radio" aria-label={label}
            aria-checked={values.avatarKey === key} title={label}
            className="grid size-16 place-items-center rounded-2xl border bg-card aria-checked:ring-2 aria-checked:ring-ring aria-checked:ring-offset-2 aria-checked:ring-offset-background"
            onClick={() => { setSaved(null); setDraft({ ...values, avatarKey: key }); }}>
            <MemberAvatar member={childWorldMember(member, { ...values, avatarKey: key })} size="lg" className="ring-0" />
          </button>)}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || !online || draft === null}>{pending ? "Guardando…" : "Guardar apariencia"}</Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={() => { setSaved(null); setDraft({ accentColor: null, avatarKey: null }); }}>Usar apariencia familiar</Button>
      </div>
      {error ? <p role="alert" className="text-destructive">{error}</p> : null}
      {!online ? <p role="status" className="text-sm text-muted-foreground">Sin conexión: podrás guardar tu apariencia cuando vuelva la red.</p> : null}
    </form>
  </Panel>;
}
