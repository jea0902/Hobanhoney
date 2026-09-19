import { NextResponse } from "next/server";
import { getOwnerBalance } from "@/lib/bybitPrivate";
import { recordBalanceSnapshot } from "@/lib/balanceSnapshots";

// 외부 스케줄러(GitHub Actions)가 6시간마다 호출해서 잔액 스냅샷을 쌓는다.
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const balance = await getOwnerBalance();
  if (!balance) {
    return NextResponse.json({ error: "잔액 조회 실패" }, { status: 502 });
  }

  await recordBalanceSnapshot(balance.totalEquity);
  return NextResponse.json({ ok: true, totalEquity: balance.totalEquity });
}
