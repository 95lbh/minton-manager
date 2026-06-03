import type { MetadataRoute } from "next";

/** PWA 매니페스트. app/manifest.ts 가 있으면 Next가 <link rel="manifest">를 자동 연결한다. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "배드민턴 매니저",
    short_name: "배드민턴",
    description: "배드민턴 동호회 운영 — 출석·코트 배정·게임·통계",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#4281A4",
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
