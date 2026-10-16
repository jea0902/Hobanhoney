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

// 운영자 포지션 페이지(/founder)는 2026-10-17부터 누구나 볼 수 있게 잠금을 풀었다 (사용자 결정).
export const config = {
  matcher: ["/admin/:path*"],
};
