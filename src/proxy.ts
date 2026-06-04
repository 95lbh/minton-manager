import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16부터 Middleware는 Proxy로 명칭이 변경되었다(기능 동일).
 * 매 요청마다 Supabase 세션을 갱신하고 보호 경로를 가드한다.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * 다음을 제외한 모든 경로에서 실행:
     *  - _next/static, _next/image, favicon
     *  - 공개 정적 파일: sw.js, offline.html
     *  - 정적 자산 확장자(이미지/폰트/매니페스트)
     * ⚠️ manifest.webmanifest 를 제외하지 않으면, 보호 경로로 취급돼 미인증 요청이
     *    매번 307 리다이렉트되어 무한 로딩을 유발한다(webmanifest 확장자로 제외).
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|webmanifest)$).*)",
  ],
};
