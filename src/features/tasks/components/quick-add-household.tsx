"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createHouseholdTaskAction } from "../actions";
import { useClock } from "@/components/clock/clock-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCommandId } from "@/hooks/use-command-id";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { localDateOf } from "@/lib/time/zoned";

/** Alta rápida de un pendiente para hoy (sin hora). */
export function QuickAddHousehold() {
  const { now, timeZone } = useClock();
  const online = useOnlineStatus();
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const [commandId, renewCommandId] = useCommandId();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = title.trim();
    if (!value) return;
    startTransition(async () => {
      const result = await createHouseholdTaskAction({
        commandId,
        values: {
          title: value,
          notes: "",
          assigneeMemberId: null,
          dueDate: localDateOf(now, timeZone),
          dueTime: null,
          priority: "normal",
          visibility: "family",
        },
      });
      if (result.ok) {
        setTitle("");
        renewCommandId();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <label htmlFor="quick-household" className="sr-only">
        Nuevo pendiente para hoy
      </label>
      <Input
        id="quick-household"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Agregar pendiente para hoy…"
        maxLength={120}
        disabled={!online}
      />
      <Button type="submit" disabled={pending || !online || !title.trim()} aria-label="Agregar pendiente">
        <Plus aria-hidden /> <span className="hidden sm:inline">Agregar</span>
      </Button>
    </form>
  );
}
