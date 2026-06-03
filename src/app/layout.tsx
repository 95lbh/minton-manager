import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "마이민턴 (myminton)",
  description: "마이민턴 — 배드민턴 동호회 운영(출석·코트 배정·게임·통계)",
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
      </body>
    </html>
  );
}
