import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_SESSION_COOKIE = "admin_session";

export function middleware(request: NextRequest) {
  const isAuthed = request.cookies.get(ADMIN_SESSION_COOKIE)?.value === process.env.ADMIN_PASSWORD;
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/admin/login";

  if (isLoginPage) {
    if (isAuthed) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  if (!isAuthed) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

// 운영자 계좌(잔액 추이·월별 성과)는 관리자만 본다(/admin/account, 2026-10-31 사용자 결정).
// 예전 /founder는 누구나 볼 수 있는 트레이더 페이지(/traders/다크페페)로 보낸다.
export const config = {
  matcher: ["/admin/:path*"],
};
