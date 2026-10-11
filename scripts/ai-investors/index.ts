// 실행: npm run ai-investors            (데이터를 쌓고 결과를 DB에 반영)
//       npm run ai-investors -- --dry-run (DB에 쓰지 않고 결과만 출력)
// GitHub Actions(.github/workflows/ai-investors.yml)가 매일 한 번 돌린다.
// 매번 2026-03-06부터 처음부터 다시 계산한다 — 상태를 이어 붙이는 것보다 단순하고, 데이터가 고쳐지면 결과도 따라 고쳐진다.
import { runBurry } from "./burry.ts";
import { runBuffett } from "./buffett.ts";
import type { AiId } from "./config.ts";
import { DRY_RUN, logEvent, replaceRows } from "./db.ts";
import { runFearGreed, runKoreanAnt, runWallstreet } from "./funds.ts";
import { runHobanhoney } from "./hobanhoney.ts";
import type { EquityRow, HoldingRow, TradeRow } from "./ledger.ts";
import { loadAndRefreshMarket } from "./market.ts";
import { runWonyotti } from "./wonyotti.ts";

interface Result {
  ai: AiId;
  trades: TradeRow[];
  holdings: HoldingRow[];
  equity: EquityRow[];
}

async function save(result: Result) {
  const last = result.equity.at(-1);
  if (last) {
    const rate = (last.equity / last.invested - 1) * 100;
    console.log(
      `${result.ai}: 입금 $${last.invested.toFixed(2)} → $${last.equity.toFixed(2)} (${rate >= 0 ? "+" : ""}${rate.toFixed(2)}%), ` +
        `현금 $${last.cash.toFixed(2)}, 보유 ${result.holdings.length}종목, 거래 ${result.trades.length}건`,
    );
  }
  await replaceRows("ai_trades", result.ai, result.trades);
  await replaceRows("ai_holdings", result.ai, result.holdings);
  await replaceRows("ai_equity_daily", result.ai, result.equity);
}

async function main() {
  if (!process.env.SEC_CONTACT_EMAIL)
    throw new Error("SEC_CONTACT_EMAIL 환경변수가 없음 (SEC가 연락처 없는 요청을 막음)");
  const market = await loadAndRefreshMarket();

  // 미국 ETF·주식은 VOO, 한국은 KODEX 200의 마지막 거래일까지
  const usToday = market.lastDate("VOO")!;
  const krToday = market.lastDate("069500.KS")!;
  for (const ledger of [
    runWallstreet(market, usToday),
    runKoreanAnt(market, krToday),
    runFearGreed(market, usToday),
    runBuffett(market, usToday),
    runBurry(market, usToday),
  ]) {
    const today = ledger.ai === "korean_ant" ? krToday : usToday;
    await save({
      ai: ledger.ai,
      trades: ledger.trades,
      holdings: ledger.holdingRows(today),
      equity: ledger.equity,
    });
  }

  const hobanhoney = await runHobanhoney(market);
  await save({ ai: "hobanhoney", ...hobanhoney });

  const wonyotti = await runWonyotti(market);
  await save({ ai: "wonyotti", ...wonyotti });

  console.log(DRY_RUN ? "[dry-run] DB에 쓰지 않음" : "완료");
}

main().catch(async (error) => {
  await logEvent("error", "AI 투자자 계산 실패", String(error?.stack ?? error));
  process.exit(1);
});
