import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ROUTES } from "@/lib/constants";

/** 개인정보처리방침·이용약관 등 법적 고지 페이지 공용 레이아웃(앱 셸 없이 단독 표시). */
export function LegalPage({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href={ROUTES.home} className="text-lg font-bold">
            마이민턴
          </Link>
          <Link
            href={ROUTES.home}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" /> 홈으로
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          시행일: {effectiveDate}
        </p>
        <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground/90">
          {children}
        </div>
      </main>

      <footer className="border-t py-6">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-5 text-xs text-muted-foreground">
          <Link href={ROUTES.privacy} className="hover:text-foreground">
            개인정보처리방침
          </Link>
          <Link href={ROUTES.terms} className="hover:text-foreground">
            이용약관
          </Link>
          <span>마이민턴 (myminton)</span>
        </div>
      </footer>
    </div>
  );
}

/** 법적 고지 문서의 한 절(제목 + 본문). */
export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-foreground">{heading}</h2>
      <div className="mt-2 space-y-2 text-muted-foreground">{children}</div>
    </section>
  );
}
