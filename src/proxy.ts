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
     * _next/static, _next/image, favicon, 정적 파일 확장자
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
