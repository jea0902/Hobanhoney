import { NextResponse } from "next/server";

// AI 투자자 파이프라인(GitHub Actions)이 AI 호반꿀 강제청산 판정용 1분봉을 여기서 받는다.
// GitHub Actions에서 Bybit을 직접 부르면 박호두 포지션 전부가 실패해서(2026-10-11) Vercel을 거친다.
// Bybit 응답을 그대로 돌려준다 (한 번에 최대 1000개).
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!symbol || !start || !end) {
    return NextResponse.json({ error: "symbol, start, end 필요" }, { status: 400 });
  }

  const res = await fetch(
    `https://api.bybit.com/v5/market/kline?category=linear&symbol=${encodeURIComponent(symbol)}` +
      `&interval=1&start=${start}&end=${end}&limit=1000`,
    { cache: "no-store" },
  );
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}
