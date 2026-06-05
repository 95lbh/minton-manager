import type { MetadataRoute } from "next";

// 공개 색인 대상은 랜딩(/) 하나. 나머지는 인증 경로라 제외.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://www.myminton.com",
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
