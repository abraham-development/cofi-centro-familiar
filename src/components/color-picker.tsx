"use client";

import { Check } from "lucide-react";
import { cn } from "cn";

import { MEMBER_COLOR_PRESETS, readableTextColor } from "@/lib/colors";

export function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {MEMBER_COLOR_PRESETS.map((c) => {
        const selected = value.toUpperCase() === c.value.toUpperCase();
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={c.label}
            title={c.label}
            onClick={() => onChange(c.value)}
            className={cn(
              "grid size-11 place-items-center rounded-full ring-offset-2 ring-offset-background transition-shadow",
              selected && "ring-3 ring-ring",
            )}
            style={{ backgroundColor: c.value, color: readableTextColor(c.value) }}
          >
            {selected ? <Check aria-hidden className="size-5" /> : null}
          </button>
        );
      })}
    </div>
  );
}
