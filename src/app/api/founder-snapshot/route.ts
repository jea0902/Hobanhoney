import { NextResponse } from "next/server";
import { getOwnerBalance, getDeposits, getWithdrawals, getClosedPnl } from "@/lib/bybitPrivate";
import { recordBalanceSnapshot } from "@/lib/balanceSnapshots";
import { upsertCashFlows } from "@/lib/cashFlows";
import { upsertClosedTrades } from "@/lib/closedTrades";

// 외부 스케줄러(GitHub Actions)가 6시간마다 호출해서 잔액 스냅샷 + 입출금 + 청산 거래 내역을 쌓는다.
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

  // 크론이 6시간마다 도니까, 혹시 한두 번 놓쳐도 안 빠지게 최근 7일치를 매번 다시 확인한다
  // (고유 id로 upsert하니 중복 걱정 없음).
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const [deposits, withdrawals, closedTrades] = await Promise.all([
    getDeposits(sevenDaysAgo, now),
    getWithdrawals(sevenDaysAgo, now),
    getClosedPnl(sevenDaysAgo, now),
  ]);
  await Promise.all([
    upsertCashFlows([...(deposits ?? []), ...(withdrawals ?? [])]),
    upsertClosedTrades(closedTrades ?? []),
  ]);

  return NextResponse.json({ ok: true, totalEquity: balance.totalEquity });
}
