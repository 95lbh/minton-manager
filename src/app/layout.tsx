import type { Metadata, Viewport } from "next";
import "./globals.css";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "@/components/ui/sonner";
import { PwaRegister } from "@/components/pwa-register";
import { AuthErrorHandler } from "@/features/auth/auth-error-handler";

// 광고는 환경변수가 있을 때만 로드(국내 한정). 미설정이면 스크립트도 넣지 않는다.
const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

// 검색 결과/공유에 노출되는 카피. 강점(동호회 운영·관리)과 혜택을 앞세운다.
const APP_TITLE = "마이민턴 — 배드민턴 동호회 출석·코트 배정·통계";
const APP_DESC =
  "출석·코트 자동 배정·게임·통계를 한 곳에서. 가입 없이 회원 관리, 모바일로 현장에서 바로 — 배드민턴 동호회 운영은 마이민턴.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.myminton.com"),
  title: APP_TITLE,
  description: APP_DESC,
  applicationName: "마이민턴",
  keywords: [
    "마이민턴",
    "myminton",
    "배드민턴",
    "배드민턴 동호회",
    "동호회 관리",
    "동호회 운영",
    "출석 체크",
    "코트 배정",
    "게임 운영",
    "배드민턴 통계",
  ],
  appleWebApp: {
    capable: true,
    title: "마이민턴",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  // 검색엔진 소유 확인(구글 서치콘솔 · 네이버 서치어드바이저) — HTML 태그 방식.
  verification: {
    google: "oVAVMsxD-3WfiUzYABlmzHEa3HQuqJYDGKCiRICpcro",
    other: {
      "naver-site-verification": "8102e58a3474262b02359af13cc233f085bcf97c",
    },
  },
  // 링크 미리보기(카카오톡/슬랙/트위터 등). og:image는 opengraph-image.tsx가 자동 생성.
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName: "마이민턴 (myminton)",
    title: APP_TITLE,
    description: APP_DESC,
  },
  twitter: {
    card: "summary_large_image",
    title: APP_TITLE,
    description: APP_DESC,
  },
};

export const viewport: Viewport = {
  themeColor: "#4281A4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        {/* Pretendard CDN 폰트: 조기 연결 + HTML에서 바로 발견되도록 <link>로 로드
            (globals.css의 @import 대비 3G에서 더 빨리 병렬 다운로드). */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Toaster position="top-center" richColors />
        <PwaRegister />
        <AuthErrorHandler />
        <Analytics />
        <SpeedInsights />
        {ADSENSE_CLIENT && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
            strategy="afterInteractive"
            crossOrigin="anonymous"
          />
        )}
      </body>
    </html>
  );
}
