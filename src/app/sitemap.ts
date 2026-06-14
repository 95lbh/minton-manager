import type { MetadataRoute } from "next";

const BASE = "https://www.myminton.com";

// 공개 색인 대상: 랜딩(/) + 법적 고지 페이지. 나머지는 인증 경로라 제외.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE, changeFrequency: "monthly", priority: 1 },
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
