import { createClient } from "@supabase/supabase-js";

export function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    global: {
      // Next.js는 라이브러리 내부 fetch까지 기본적으로 캐싱해서 DB 값이 바뀌어도
      // 예전 응답을 계속 돌려주는 문제가 있었다. 매 요청 강제로 캐시를 끈다.
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
