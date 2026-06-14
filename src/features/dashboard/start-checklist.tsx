import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { ROUTES } from "@/lib/constants";
import { SampleDataButton } from "@/features/dashboard/sample-data-button";
import type { OnboardingProgress } from "@/server/queries/onboarding";

interface Step {
  key: keyof OnboardingProgress;
  label: string;
  desc: string;
  href: string;
}

const STEPS: Step[] = [
  { key: "members", label: "회원 추가", desc: "동호회 회원을 등록하세요.", href: ROUTES.members },
  { key: "courts", label: "코트 등록", desc: "사용할 코트를 만드세요.", href: ROUTES.games },
  { key: "attendance", label: "출석 체크", desc: "오늘 온 사람을 체크하세요.", href: ROUTES.attendance },
  { key: "games", label: "게임 시작", desc: "코트에 배정하고 게임을 시작하세요.", href: ROUTES.games },
];

/**
 * 신규 클럽 시작 체크리스트.
 * 모든 단계가 완료되면(데이터가 채워지면) 렌더하지 않는다(null 반환).
 */
export function StartChecklist({ progress }: { progress: OnboardingProgress }) {
  const done = (key: keyof OnboardingProgress) => progress[key] > 0;
  const completed = STEPS.filter((s) => done(s.key)).length;
  // 완전히 빈 클럽이면 "샘플로 둘러보기"를 제안.
  const isEmpty = progress.members === 0 && progress.courts === 0;

  // 모두 끝났으면 안내를 숨긴다.
  if (completed === STEPS.length) return null;

  return (
    <div className="mt-6 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold tracking-tight">시작 가이드</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            아래 단계를 따라 운영을 준비하세요.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary tabular-nums">
          {completed} / {STEPS.length}
        </span>
      </div>

      <ol className="mt-4 space-y-1.5">
        {STEPS.map((step, i) => {
          const isDone = done(step.key);
          return (
            <li key={step.key}>
              <Link
                href={step.href}
                prefetch={false}
                className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-primary/30 hover:bg-primary/[0.03]"
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isDone
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? <Check className="size-4" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm font-medium ${
                      isDone ? "text-muted-foreground line-through" : ""
                    }`}
                  >
                    {step.label}
                  </span>
                  {!isDone && (
                    <span className="block text-xs text-muted-foreground">
                      {step.desc}
                    </span>
                  )}
                </span>
                {!isDone && (
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                )}
              </Link>
            </li>
          );
        })}
      </ol>

      {isEmpty && (
        <div className="mt-3 border-t pt-3 text-center">
          <SampleDataButton />
        </div>
      )}
    </div>
  );
}
