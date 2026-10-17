"use client";

import { Check, ChevronDown, LogOut, Moon, Sun, Users } from "lucide-react";
import { useTheme } from "next-themes";
import { useTransition } from "react";
import { toast } from "sonner";

import { MemberAvatar } from "@/components/member-chip";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/features/auth/actions";
import { switchFamilyAction } from "@/features/families/actions";
import { clearSnapshot } from "@/lib/pwa/snapshot";

export function UserMenu({
  familyName,
  activeFamilyId,
  families,
  email,
  displayName,
  roleLabel,
  avatar,
}: {
  familyName: string;
  activeFamilyId: string;
  families: { id: string; name: string }[];
  email: string | null;
  displayName: string | null;
  roleLabel: string;
  /** En celulares, el avatar del adulto es el botón del menú (indica quién está conectado). */
  avatar: { displayName: string; color: string; initials: string; avatarEmoji: string | null } | null;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [pending, startTransition] = useTransition();

  function switchTo(id: string) {
    if (id === activeFamilyId) return;
    clearSnapshot("adult");
    startTransition(async () => {
      const result = await switchFamilyAction(id);
      if (!result.ok) toast.error(result.error.message);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="max-w-56 px-2.5 sm:px-4" disabled={pending} aria-label={`Menú de ${displayName ? `${displayName} · ` : ""}${familyName}`} />}
      >
        {avatar ? (
          <span className="sm:hidden">
            <MemberAvatar member={avatar} size="sm" className="ring-0" />
          </span>
        ) : (
          <Users aria-hidden className="sm:hidden" />
        )}
        <span className="hidden truncate font-semibold sm:inline">{familyName}</span>
        <ChevronDown aria-hidden className="hidden sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            {displayName ? (
              <span className="truncate text-base font-semibold text-foreground">
                {displayName} · {roleLabel}
              </span>
            ) : null}
            <span className="truncate">{email}</span>
            <span className="truncate">{familyName}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        {families.length > 1 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center gap-2">
                <Users aria-hidden className="size-4" /> Cambiar de familia
              </DropdownMenuLabel>
              {families.map((f) => (
                <DropdownMenuItem key={f.id} onClick={() => switchTo(f.id)}>
                  {f.id === activeFamilyId ? <Check aria-hidden /> : <span className="size-4" />}
                  {f.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
          {resolvedTheme === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
          {resolvedTheme === "dark" ? "Modo claro" : "Modo nocturno"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { clearSnapshot("adult"); startTransition(() => signOutAction()); }}>
          <LogOut aria-hidden /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
