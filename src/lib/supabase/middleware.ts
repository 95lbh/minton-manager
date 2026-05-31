import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ROUTES, isPublicPath } from "@/lib/constants";
import { hasSupabaseEnv } from "@/lib/env";

/**
 * 매 요청마다 Supabase 세션을 갱신하고, 보호 경로 접근을 가드한다.
 * Supabase SSR 권장 패턴.
 */
export async function updateSession(request: NextRequest) {
  // 환경변수 미설정 시(초기 셋업 전) 미들웨어를 건너뛴다.
  if (!hasSupabaseEnv) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser()로 토큰을 검증/갱신한다. (getSession 대신 getUser 사용 권장)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = !isPublicPath(pathname);

  if (!user && isProtected) {
    // 미인증 진입은 로그인 페이지가 아니라 첫 진입 랜딩(비회원 시작 기본)으로.
    const url = request.nextUrl.clone();
    url.pathname = ROUTES.home;
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
