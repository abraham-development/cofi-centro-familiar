"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, Gift, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { cn } from "cn";

import { archiveRewardAction, saveRewardAction } from "../actions";
import type { Reward } from "../queries";
import { type RewardFormValues, rewardFormSchema } from "../schemas";
import { ConfirmAction } from "@/components/confirm-action";
import { EmptyState } from "@/components/empty-state";
import { MemberAvatar, MemberStack } from "@/components/member-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { MemberSummary } from "@/features/calendar/types";

const EMPTY: RewardFormValues = { title: "", description: "", cost: 50, isAvailable: true, conditions: "", memberIds: [] };

export function RewardsManager({ rewards, kids }: { rewards: Reward[]; kids: MemberSummary[] }) {
  const byId = new Map(kids.map((k) => [k.id, k]));
  return (
    <div className="flex flex-col gap-4">
      {rewards.length === 0 ? (
        <EmptyState
          icon={Gift}
          title="Catálogo vacío"
          description="Ideas: elegir la película familiar, escoger el postre, tiempo de una actividad acordada."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {rewards.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {r.title}
                  {!r.isAvailable ? <Badge variant="secondary">No disponible</Badge> : null}
                </p>
                <p className="text-sm text-muted-foreground">
                  {r.cost} pts{r.conditions ? ` · ${r.conditions}` : ""}
                  {r.memberIds.length === 0 ? " · para todos" : ""}
                </p>
              </div>
              {r.memberIds.length ? (
                <MemberStack members={r.memberIds.map((id) => byId.get(id)).filter((m): m is MemberSummary => !!m)} />
              ) : null}
              <RewardDialog
                reward={r}
                kids={kids}
                trigger={
                  <Button variant="ghost" size="icon" aria-label={`Editar ${r.title}`}>
                    <Pencil aria-hidden />
                  </Button>
                }
              />
              <ConfirmAction
                trigger={
                  <Button variant="ghost" size="icon" aria-label={`Archivar ${r.title}`}>
                    <Archive aria-hidden />
                  </Button>
                }
                title={`¿Archivar «${r.title}»?`}
                description="Deja de aparecer en el catálogo. Los canjes ya registrados se conservan."
                confirmLabel="Archivar"
                onConfirm={async () => {
                  const result = await archiveRewardAction({ rewardId: r.id, archived: true });
                  if (!result.ok) {
                    toast.error(result.error.message);
                    return false;
                  }
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <RewardDialog
        kids={kids}
        trigger={
          <Button variant="outline" size="lg" className="self-start">
            <Plus aria-hidden /> Nuevo premio
          </Button>
        }
      />
    </div>
  );
}

function RewardDialog({ reward, kids, trigger }: { reward?: Reward; kids: MemberSummary[]; trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const [commandId, setCommandId] = useState(() => crypto.randomUUID());
  const initial: RewardFormValues = reward
    ? {
        title: reward.title,
        description: reward.description ?? "",
        cost: reward.cost,
        isAvailable: reward.isAvailable,
        conditions: reward.conditions ?? "",
        memberIds: reward.memberIds,
      }
    : EMPTY;
  const form = useForm<RewardFormValues>({ resolver: zodResolver(rewardFormSchema), defaultValues: initial });
  const { control, register, formState } = form;

  async function onSubmit(values: RewardFormValues) {
    const result = await saveRewardAction({ commandId, rewardId: reward?.id ?? null, values });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Premio guardado");
    setCommandId(crypto.randomUUID());
    if (!reward) form.reset(EMPTY);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{reward ? "Editar premio" : "Nuevo premio"}</DialogTitle>
            <DialogDescription>Los puntos son internos de la familia y no tienen valor monetario.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={!!formState.errors.title}>
              <FieldLabel htmlFor="reward-title">Premio</FieldLabel>
              <Input id="reward-title" maxLength={80} placeholder="Elegir la película del viernes" {...register("title")} />
              <FieldError errors={[formState.errors.title]} />
            </Field>
            <Field data-invalid={!!formState.errors.cost}>
              <FieldLabel htmlFor="reward-cost">Costo en puntos</FieldLabel>
              <Input id="reward-cost" type="number" min={1} {...register("cost", { valueAsNumber: true })} />
              <FieldError errors={[formState.errors.cost]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="reward-conditions">Condiciones (opcional)</FieldLabel>
              <Input id="reward-conditions" maxLength={300} placeholder="Solo fines de semana" {...register("conditions")} />
            </Field>
            <Controller
              control={control}
              name="memberIds"
              render={({ field }) => (
                <FieldSet>
                  <FieldLegend>¿Para quién?</FieldLegend>
                  <FieldDescription>Si no eliges a nadie, está disponible para todos los hijos.</FieldDescription>
                  <div className="flex flex-wrap gap-2">
                    {kids.map((k) => {
                      const selected = field.value.includes(k.id);
                      return (
                        <button
                          key={k.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() =>
                            field.onChange(selected ? field.value.filter((id) => id !== k.id) : [...field.value, k.id])
                          }
                          className={cn(
                            "flex min-h-10 items-center gap-2 rounded-lg border py-1 pr-3 pl-1 text-sm font-medium pointer-coarse:min-h-11",
                            !selected && "hover:bg-muted",
                          )}
                          style={selected ? { borderColor: k.color, backgroundColor: `${k.color}1f` } : undefined}
                        >
                          <MemberAvatar member={k} size="sm" />
                          {k.displayName}
                        </button>
                      );
                    })}
                  </div>
                </FieldSet>
              )}
            />
            <Controller
              control={control}
              name="isAvailable"
              render={({ field }) => (
                <Field orientation="horizontal">
                  <Switch id="reward-available" checked={field.value} onCheckedChange={field.onChange} />
                  <FieldLabel htmlFor="reward-available">Disponible para pedir</FieldLabel>
                </Field>
              )}
            />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Volver
            </Button>
            <Button type="submit" disabled={formState.isSubmitting}>
              {formState.isSubmitting ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
