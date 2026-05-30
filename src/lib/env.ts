/** Supabase 환경변수가 설정되어 있는지. (미설정 시 dev 서버는 뜨되 인증 기능은 비활성) */
export const hasSupabaseEnv =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
