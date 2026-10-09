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
    // 운영자 포지션 페이지에서 왔으면 로그인 후 다시 그 페이지로 돌려보낸다.
    const loginUrl = new URL("/admin/login", request.url);
    if (pathname === "/founder") loginUrl.searchParams.set("next", "/founder");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // 운영자 포지션 페이지는 실계좌 정보라 관리자 비밀번호로 잠근다.
  matcher: ["/admin/:path*", "/founder"],
};
