"use client";

import { SKILL_GRADES, type SkillGrade } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type GradeValue = SkillGrade | "none";

/** S~F 등급 버튼 토글. 같은 버튼을 다시 누르면 선택 해제(none). */
export function GradeToggle({
  value,
  onChange,
  disabled,
}: {
  value: GradeValue;
  onChange: (v: GradeValue) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1.5">
      {SKILL_GRADES.map((g) => {
        const active = value === g;
        return (
          <button
            key={g}
            type="button"
            disabled={disabled}
            onClick={() => onChange(active ? "none" : g)}
            className={cn(
              "h-10 flex-1 rounded-lg border text-sm font-semibold transition-colors disabled:opacity-50",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card hover:bg-muted",
            )}
          >
            {g}
          </button>
        );
      })}
    </div>
  );
}
