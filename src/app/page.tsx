import { redirect } from "next/navigation";
import Link from "next/link";
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
import { Reveal } from "@/components/reveal";
import { Slideshow, type Slide } from "@/components/slideshow";

const FEATURES: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: ClipboardCheck,
    title: "출석 관리",
    desc: "회원·게스트 출석을 한 번에. 명단과 대기 인원을 바로 정리합니다.",
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

const SLIDES: Slide[] = [
  {
    src: "/screenshots/court2.png",
    alt: "마이민턴 코트 현황 화면 — 코트별 진행 게임과 대기자 자동 배정",
    title: "코트 자동 배정 & 게임 운영",
    desc: "대기 순서·파트너 다양성·실력 균형을 고려한 자동 배정. 코트별 게임 시작·종료와 대기열을 모바일로 한눈에, 중복 배정도 막아줍니다.",
  },
  {
    src: "/screenshots/attendance.png",
    alt: "마이민턴 출석 관리 화면 — 회원·게스트 출석 체크",
    title: "출석 관리",
    desc: "회원·게스트 출석을 한 번에 체크해요. 명단과 대기 인원이 바로 정리됩니다.",
  },
  {
    src: "/screenshots/stats.png",
    alt: "마이민턴 통계 화면 — 회원별 참여와 성별·급수 분포",
    title: "참여 통계",
    desc: "회원별 참여와 성별·급수·나이대 분포까지 자동 집계로 클럽 현황을 한눈에 파악합니다.",
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
            <Reveal>
              <p className="text-sm font-semibold text-primary">
                {APP_NAME} · myminton
              </p>
            </Reveal>
            <Reveal delay={120}>
              <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                배드민턴 동호회 운영,
                <br />
                마이민턴 하나로.
              </h1>
            </Reveal>
            <Reveal delay={240}>
              <p className="mt-4 text-base text-muted-foreground">
                출석 체크부터 코트 자동 배정, 게임 운영, 통계까지. 회원은 가입 없이,
                관리자는 모바일로 현장에서 바로. 설치 없이 URL만으로 시작하세요.
              </p>
            </Reveal>
            <Reveal delay={360}>
              <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <li>✓ 가입 없이 1초 시작</li>
                <li>✓ 모바일 최적화</li>
                <li>✓ 무료</li>
              </ul>
            </Reveal>
          </div>

          <Reveal delay={200} className="flex justify-center lg:justify-end">
            <LandingAuth />
          </Reveal>
        </div>

        {/* 하단: 화면+기능을 하나의 자동 슬라이드쇼로 */}
        <section className="mt-14 sm:mt-20">
          <Reveal>
            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
              운영은 가볍게, 게임은 더 많이
            </h2>
            <p className="mt-2 text-center text-sm text-muted-foreground sm:text-base">
              출석부터 코트 배정·게임·통계까지, 한 손에서 끝나요.
            </p>
          </Reveal>

          <Reveal className="mt-8">
            <Slideshow slides={SLIDES} />
          </Reveal>

          {/* 그 외 기능 요약 */}
          <Reveal className="mx-auto mt-8 flex max-w-2xl flex-wrap justify-center gap-2">
            {FEATURES.map((f) => (
              <span
                key={f.title}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm text-muted-foreground shadow-sm"
              >
                <f.icon className="size-4 text-primary" />
                {f.title}
              </span>
            ))}
          </Reveal>
        </section>

        <footer className="mt-16 flex flex-col items-center gap-2 text-center text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <Link href={ROUTES.privacy} className="hover:text-foreground">
              개인정보처리방침
            </Link>
            <Link href={ROUTES.terms} className="hover:text-foreground">
              이용약관
            </Link>
          </div>
          <span>마이민턴 (myminton) · made by bhlee</span>
        </footer>
      </div>
    </main>
  );
}
