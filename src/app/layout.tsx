import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { PwaRegister } from "@/components/pwa-register";
import { AuthErrorHandler } from "@/features/auth/auth-error-handler";

const APP_DESC = "배드민턴 동호회 운영을 한 곳에서 — 출석 · 코트 배정 · 게임 · 통계.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.myminton.com"),
  title: "마이민턴 (myminton)",
  description: APP_DESC,
  applicationName: "마이민턴",
  appleWebApp: {
    capable: true,
    title: "마이민턴",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  // 링크 미리보기(카카오톡/슬랙/트위터 등). og:image는 opengraph-image.tsx가 자동 생성.
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName: "마이민턴 (myminton)",
    title: "마이민턴 (myminton)",
    description: APP_DESC,
  },
  twitter: {
    card: "summary_large_image",
    title: "마이민턴 (myminton)",
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
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Toaster position="top-center" richColors />
        <PwaRegister />
        <AuthErrorHandler />
      </body>
    </html>
  );
}
