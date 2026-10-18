"use client";

import { Archive, ArchiveRestore, Pencil, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { archiveMemberAction } from "../actions";
import type { FamilyMemberRow } from "../queries";
import { MemberDialog } from "./member-dialog";
import { ConfirmAction } from "@/components/confirm-action";
import { MemberAvatar } from "@/components/member-chip";
import { Button } from "@/components/ui/button";

const KIND_LABEL = { adult: "Adulto", child: "Hijo/a", other: "Otra persona" } as const;

const NEW_MEMBER = { displayName: "", kind: "child" as const, color: "#16A34A", initials: "", avatarEmoji: "" };

export function MembersManager({ members }: { members: FamilyMemberRow[] }) {
  const active = members.filter((m) => !m.archivedAt);
  const archived = members.filter((m) => m.archivedAt);

  async function setArchived(member: FamilyMemberRow, archivedValue: boolean) {
    const result = await archiveMemberAction({ memberId: member.id, archived: archivedValue });
    if (!result.ok) {
      toast.error(result.error.message);
      return false;
    }
    toast.success(archivedValue ? `${member.displayName} archivado` : `${member.displayName} restaurado`);
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {active.map((m) => (
          <li key={m.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
            <MemberAvatar member={m} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{m.displayName}</p>
              <p className="text-sm text-muted-foreground">
                {KIND_LABEL[m.kind]}
                {m.hasAccount ? " · con cuenta" : ""}
              </p>
            </div>
            <MemberDialog
              memberId={m.id}
              lockKind={m.hasAccount}
              initialValues={{
                displayName: m.displayName,
                kind: m.kind,
                color: m.color,
                initials: m.initials,
                avatarEmoji: m.avatarEmoji ?? "",
              }}
              trigger={
                <Button variant="outline" size="icon" aria-label={`Editar a ${m.displayName}`}>
                  <Pencil aria-hidden />
                </Button>
              }
            />
            {!m.hasAccount ? (
              <ConfirmAction
                trigger={
                  <Button variant="ghost" size="icon" aria-label={`Archivar a ${m.displayName}`}>
                    <Archive aria-hidden />
                  </Button>
                }
                title={`¿Archivar a ${m.displayName}?`}
                description="Dejará de aparecer en formularios y pantallas. Su historial se conserva y puedes restaurarlo."
                confirmLabel="Archivar"
                onConfirm={() => setArchived(m, true)}
              />
            ) : null}
          </li>
        ))}
      </ul>
      <MemberDialog
        initialValues={NEW_MEMBER}
        trigger={
          <Button variant="outline" size="lg" className="self-start">
            <UserPlus aria-hidden /> Agregar integrante
          </Button>
        }
      />
      {archived.length > 0 ? (
        <details className="rounded-xl border p-3">
          <summary className="cursor-pointer font-semibold">Archivados ({archived.length})</summary>
          <ul className="mt-3 flex flex-col gap-2">
            {archived.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <MemberAvatar member={m} size="sm" />
                <span className="flex-1">{m.displayName}</span>
                <Button variant="ghost" size="sm" onClick={() => void setArchived(m, false)}>
                  <ArchiveRestore aria-hidden /> Restaurar
                </Button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
