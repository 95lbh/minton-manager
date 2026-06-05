import type { MetadataRoute } from "next";

// 검색 크롤러 규칙. 공개 랜딩만 색인하고, 인증·운영 경로는 차단.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/members",
        "/attendance",
        "/games",
        "/stats",
        "/tournaments",
        "/settings",
        "/onboarding",
        "/auth",
      ],
    },
    sitemap: "https://www.myminton.com/sitemap.xml",
  };
}
