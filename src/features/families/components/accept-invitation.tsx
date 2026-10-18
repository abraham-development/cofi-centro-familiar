"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { acceptInvitationAction } from "../actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function AcceptInvitation({ token, familyName }: { token: string; familyName: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function accept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptInvitationAction({ token, displayName });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.replace("/casa");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Te invitaron a «{familyName}»</h1>
        <p className="text-muted-foreground">Podrás ver y administrar la agenda y los pendientes de la familia.</p>
      </div>
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Field>
        <FieldLabel htmlFor="display-name">¿Cómo te verán en las pantallas? (opcional)</FieldLabel>
        <Input id="display-name" maxLength={40} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ej.: Papá" />
        <FieldDescription>Si ya te habían agregado como integrante, se usará ese perfil.</FieldDescription>
      </Field>
      <Button size="lg" onClick={accept} disabled={pending}>
        {pending ? "Uniéndote…" : "Aceptar invitación"}
      </Button>
    </div>
  );
}
