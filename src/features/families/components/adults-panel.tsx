"use client";

import { Copy, Mail, Share2, ShieldCheck, UserMinus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createInvitationAction, revokeInvitationAction, updateAdultMembershipAction } from "../actions";
import type { AdultRow, FamilyMemberRow, InvitationRow } from "../queries";
import { ConfirmAction } from "@/components/confirm-action";
import { MemberAvatar } from "@/components/member-chip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatShortDate } from "@/lib/time/zoned";

const ROLE_LABEL = { owner: "Propietario", admin: "Administrador" } as const;

export function AdultsPanel({
  adults,
  invitations,
  linkableMembers,
  isOwner,
}: {
  adults: AdultRow[];
  invitations: InvitationRow[];
  linkableMembers: FamilyMemberRow[];
  isOwner: boolean;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "owner">("admin");
  const [memberId, setMemberId] = useState<string>("nuevo");
  const [link, setLink] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function invite(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createInvitationAction({ email, role, memberId: memberId === "nuevo" ? null : memberId });
      if (!result.ok) {
        toast.error(result.error.fieldErrors?.email ?? result.error.message);
        return;
      }
      setLink(result.data.link);
      setEmail("");
    });
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar. Selecciona el enlace y cópialo manualmente.");
    }
  }

  async function changeMembership(adult: AdultRow, change: { role?: "owner" | "admin"; remove?: boolean }) {
    const result = await updateAdultMembershipAction({ membershipId: adult.membershipId, ...change });
    if (!result.ok) {
      toast.error(result.error.message);
      return false;
    }
    toast.success(change.remove ? "Acceso retirado" : "Rol actualizado");
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col gap-2">
        {adults.map((a) => (
          <li key={a.membershipId} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
            <MemberAvatar member={{ ...a, avatarEmoji: null }} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {a.displayName}
                {a.isMe ? <span className="font-normal text-muted-foreground"> (tú)</span> : null}
              </p>
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <ShieldCheck aria-hidden className="size-4" /> {ROLE_LABEL[a.role]}
              </p>
            </div>
            {isOwner && !a.isMe ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void changeMembership(a, { role: a.role === "owner" ? "admin" : "owner" })}
              >
                {a.role === "owner" ? "Hacer administrador" : "Hacer propietario"}
              </Button>
            ) : null}
            {isOwner || a.isMe ? (
              <ConfirmAction
                trigger={
                  <Button variant="ghost" size="icon" aria-label={a.isMe ? "Salir de la familia" : `Retirar acceso a ${a.displayName}`}>
                    <UserMinus aria-hidden />
                  </Button>
                }
                title={a.isMe ? "¿Salir de esta familia?" : `¿Retirar el acceso de ${a.displayName}?`}
                description="Dejará de ver la información de la familia de inmediato. La familia siempre debe conservar un propietario."
                confirmLabel={a.isMe ? "Salir" : "Retirar acceso"}
                onConfirm={() => changeMembership(a, { remove: true })}
              />
            ) : null}
          </li>
        ))}
      </ul>

      {isOwner ? (
        <form onSubmit={invite} className="flex flex-col gap-4 rounded-2xl border p-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <Mail aria-hidden className="size-5" /> Invitar a otro adulto
          </h3>
          <Field>
            <FieldLabel htmlFor="invite-email">Correo del adulto</FieldLabel>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              required
            />
            <FieldDescription>Solo esa persona, con ese correo, podrá aceptar. El enlace vence en 7 días.</FieldDescription>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Rol</FieldLabel>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as "admin" | "owner")}
                items={[
                  { value: "admin", label: "Administrador" },
                  { value: "owner", label: "Propietario" },
                ]}
              >
                <SelectTrigger className="w-full" aria-label="Rol">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="owner">Propietario</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {linkableMembers.length > 0 ? (
              <Field>
                <FieldLabel>Es el integrante…</FieldLabel>
                <Select
                  value={memberId}
                  onValueChange={(v) => setMemberId(v as string)}
                  items={[
                    { value: "nuevo", label: "Crear integrante nuevo" },
                    ...linkableMembers.map((m) => ({ value: m.id, label: m.displayName })),
                  ]}
                >
                  <SelectTrigger className="w-full" aria-label="Integrante">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nuevo">Crear integrante nuevo</SelectItem>
                    {linkableMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </div>
          <Button type="submit" className="self-start" disabled={pending || !email}>
            {pending ? "Generando…" : "Generar enlace de invitación"}
          </Button>
          {link ? (
            <Alert role="status">
              <AlertTitle>Enlace listo para compartir</AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                <span>Este enlace solo se muestra ahora. Compártelo por un canal privado.</span>
                <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Enlace de invitación" />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={copy}>
                    <Copy aria-hidden /> Copiar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    nativeButton={false}
                    render={
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`Te invito al Centro Familiar: ${link}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                  >
                    <Share2 aria-hidden /> WhatsApp
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}
        </form>
      ) : (
        <p className="text-muted-foreground">Solo un propietario puede invitar o retirar adultos.</p>
      )}

      {invitations.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold">Invitaciones pendientes</h3>
          <ul className="flex flex-col gap-2">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
                <span className="min-w-0 flex-1 truncate font-medium">{inv.email}</span>
                <span className="text-sm text-muted-foreground">
                  {ROLE_LABEL[inv.role]} · vence {formatShortDate(inv.expiresAt.slice(0, 10))}
                </span>
                {isOwner ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      const result = await revokeInvitationAction(inv.id);
                      if (result.ok) toast.success("Invitación anulada");
                      else toast.error(result.error.message);
                    }}
                  >
                    Anular
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
