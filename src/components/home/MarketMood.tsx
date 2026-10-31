import { getYahooQuote } from "@/lib/yahooFinance";
import { getCryptoFearGreed } from "@/lib/alternativeMe";
import { getBtcDominance } from "@/lib/coingecko";

// 홈에서는 매일 바뀌는 시장 분위기 지표 세 개만 한 줄로 보여준다. 나머지 경제 지표는 이벤트 메뉴에 있다.
export default async function MarketMood() {
  const [vix, fearGreed, dominance] = await Promise.all([
    getYahooQuote("^VIX"),
    getCryptoFearGreed(),
    getBtcDominance(),
  ]);

  return (
    <section className="px-6 pt-2">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-2xl border border-gray-200 px-4 py-2 text-xs dark:border-gray-800">
        <span className="font-bold text-gray-900 dark:text-gray-100">시장 분위기</span>
        {vix && (
          <span className="text-gray-700 dark:text-gray-300" title="높을수록 주식 시장 불안">
            <span className="text-gray-400">VIX</span> {vix.price.toFixed(2)}{" "}
            <span className={vix.changePercent >= 0 ? "text-red-500" : "text-blue-500"}>
              {vix.changePercent >= 0 ? "▲" : "▼"}
              {Math.abs(vix.changePercent).toFixed(2)}%
            </span>
          </span>
        )}
        {fearGreed && (
          <span className="text-gray-700 dark:text-gray-300">
            <span className="text-gray-400">코인 공포탐욕</span> {fearGreed.value} ·{" "}
            {fearGreed.classification}
          </span>
        )}
        {dominance !== null && (
          <span
            className="text-gray-700 dark:text-gray-300"
            title="내려가면 알트코인으로 돈이 옮겨가는 신호"
          >
            <span className="text-gray-400">비트코인 도미넌스</span> {dominance.toFixed(2)}%
          </span>
        )}
      </div>
    </section>
  );
}
