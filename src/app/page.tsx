import { redirect } from "next/navigation";
import {
  ClipboardCheck,
  LayoutGrid,
  Users,
  BarChart3,
  Trophy,
  Share2,
  type LucideIcon,
} from "lucide-react";
import { hasSupabaseEnv } from "@/lib/env";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { getCurrentUser } from "@/server/queries/auth";
import { LandingAuth } from "@/features/auth/landing-auth";

const FEATURES: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: ClipboardCheck,
    title: "출석 관리",
    desc: "회원·게스트 출석을 한 번에. QR 셀프 체크인도 지원해 현장이 빨라집니다.",
  },
  {
    icon: LayoutGrid,
    title: "코트 자동 배정",
    desc: "대기 순서·파트너 다양성·실력 균형을 고려한 자동 추천으로 공정하게.",
  },
  {
    icon: Users,
    title: "게임 운영",
    desc: "코트별 게임 시작·종료와 대기열을 모바일로 한눈에. 중복 배정도 방지.",
  },
  {
    icon: BarChart3,
    title: "참여 통계",
    desc: "회원별 참여, 성별·급수 분포까지 자동 집계로 클럽 현황을 파악합니다.",
  },
  {
    icon: Trophy,
    title: "대회 모드",
    desc: "토너먼트·리그·청백전 대진과 결과를 일반 운영과 분리해 관리합니다.",
  },
  {
    icon: Share2,
    title: "함께 운영",
    desc: "공유 코드로 공동 관리자를 초대하고 소유권까지 넘길 수 있어요.",
  },
];

const SITE_URL = "https://www.myminton.com";

// 검색엔진용 구조화 데이터(schema.org). 서비스 정체성·로고·기능을 명시적으로 알린다.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: "마이민턴",
      url: SITE_URL,
      logo: `${SITE_URL}/icon-512.png`,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "마이민턴 (myminton)",
      inLanguage: "ko-KR",
      publisher: { "@id": `${SITE_URL}/#org` },
    },
    {
      "@type": "WebApplication",
      name: "마이민턴 (myminton)",
      url: SITE_URL,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "ko-KR",
      description:
        "출석·코트 자동 배정·게임·통계를 한 곳에서. 배드민턴 동호회 운영·관리 서비스.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
      publisher: { "@id": `${SITE_URL}/#org` },
      featureList: FEATURES.map((f) => f.title),
    },
  ],
};

/**
 * 첫 진입(랜딩). 로그인/익명 세션이 있으면 대시보드로.
 * 비로그인 방문자에겐 서비스 소개 + 시작 카드를 보여준다(검색 색인 + 첫인상).
 */
export default async function Home() {
  if (hasSupabaseEnv) {
    const user = await getCurrentUser();
    if (user) redirect(ROUTES.dashboard);
  }

  return (
    <main className="min-h-dvh bg-muted/20">
      {/* 구조화 데이터 (검색엔진 전용, 화면 미표시) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <div className="mx-auto max-w-5xl px-6 py-12 sm:py-20">
        {/* Hero */}
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-primary">
              {APP_NAME} · myminton
            </p>
            <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              배드민턴 동호회 운영,
              <br />
              마이민턴 하나로.
            </h1>
            <p className="mt-4 text-base text-muted-foreground">
              출석 체크부터 코트 자동 배정, 게임 운영, 통계까지. 회원은 가입 없이,
              관리자는 모바일로 현장에서 바로. 설치 없이 URL만으로 시작하세요.
            </p>
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <li>✓ 가입 없이 1초 시작</li>
              <li>✓ 모바일 최적화</li>
              <li>✓ 무료</li>
            </ul>
          </div>

          <div className="flex justify-center lg:justify-end">
            <LandingAuth />
          </div>
        </div>

        {/* 기능 소개 */}
        <section className="mt-16 sm:mt-24">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            동호회 운영에 필요한 모든 것
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            출석·코트·게임·통계·대회까지, 현장 운영 도구로 설계했습니다.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border bg-card p-5 shadow-sm"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="size-5" />
                </div>
                <h3 className="mt-3 font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-16 text-center text-xs text-muted-foreground">
          마이민턴 (myminton) · made by bhlee
        </footer>
      </div>
    </main>
  );
}
