"use client";

import { useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * Confirmación para acciones destructivas: nunca se activan con un toque
 * accidental. El diálogo permanece hasta que el adulto decide.
 */
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
  children,
}: {
  trigger: React.ReactElement;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<boolean | void>;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    setPending(true);
    try {
      const result = await onConfirm();
      if (result !== false) setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Volver</AlertDialogCancel>
          <Button variant="destructive" onClick={handleConfirm} disabled={pending}>
            {pending ? "Procesando…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
