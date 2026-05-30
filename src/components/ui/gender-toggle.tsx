"use client";

import { cn } from "@/lib/utils";

export type GenderValue = "male" | "female" | "none";

const OPTIONS: { value: GenderValue; label: string }[] = [
  { value: "male", label: "남" },
  { value: "female", label: "여" },
];

/** 남/여 버튼 토글. 같은 버튼을 다시 누르면 선택 해제(none). */
export function GenderToggle({
  value,
  onChange,
  disabled,
}: {
  value: GenderValue;
  onChange: (v: GenderValue) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-2">
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(active ? "none" : opt.value)}
            className={cn(
              "h-10 flex-1 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card hover:bg-muted",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
