import { getYahooQuote } from "@/lib/yahooFinance";
import { getUst1Y } from "@/lib/fred";
import { getBithumbQuote } from "@/lib/bithumb";
import { getKoreaBond3Y } from "@/lib/naverStock";
import HorizontalScrollArrows from "@/components/HorizontalScrollArrows";

interface TickerItem {
  label: string;
  value: string;
  delta: string;
  up: boolean;
}

// 야후·빗썸·네이버 시세 모두 "가격 + 등락률" 형태라 같은 박스로 만든다.
function toItem(
  label: string,
  quote: { price: number; changePercent: number } | null,
  formatValue: (price: number) => string,
): TickerItem | null {
  if (!quote) return null;
  return {
    label,
    value: formatValue(quote.price),
    delta: `${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%`,
    up: quote.changePercent >= 0,
  };
}

const index = (p: number) => p.toLocaleString("en-US", { maximumFractionDigits: 2 });
const usd = (digits: number) => (p: number) =>
  `$ ${p.toLocaleString("en-US", { maximumFractionDigits: digits })}`;
const krw = (p: number) => `${p.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원`;
const rate = (p: number) => `${p.toFixed(2)}%`;

// 네이버 증권 지수 박스처럼 주요 자산 가격을 가로로 나열한다 (차트 없이). 넘치면 화살표로 넘긴다.
export default async function MarketCards() {
  const [kospi, nasdaq, sp500, usdKrw, usdt, usdc, gold, btc, eth, kr3y, ust1y, ust5y, ust10y] =
    await Promise.all([
      getYahooQuote("^KS11"),
      getYahooQuote("^IXIC"),
      getYahooQuote("^GSPC"),
      getYahooQuote("KRW=X"),
      getBithumbQuote("USDT"),
      getBithumbQuote("USDC"),
      getYahooQuote("GC=F"),
      getYahooQuote("BTC-USD"),
      getYahooQuote("ETH-USD"),
      getKoreaBond3Y(),
      getUst1Y(),
      getYahooQuote("^FVX"),
      getYahooQuote("^TNX"),
    ]);

  const items = [
    toItem("코스피", kospi, index),
    toItem("나스닥종합", nasdaq, index),
    toItem("S&P500", sp500, index),
    toItem("원/달러 환율", usdKrw, krw),
    // 테더·서클은 1달러 고정 코인이라 원화 가격이 사실상 국내 거래소 환율이다.
    toItem("테더 (USDT)", usdt, krw),
    toItem("서클 (USDC)", usdc, krw),
    toItem("국제 금", gold, usd(2)),
    toItem("비트코인", btc, usd(0)),
    toItem("이더리움", eth, usd(2)),
    toItem("한국채 3년물", kr3y && { price: kr3y.value, changePercent: kr3y.changePercent }, rate),
    toItem(
      "미국채 1년물",
      ust1y?.previousValue
        ? { price: ust1y.value, changePercent: (ust1y.value / ust1y.previousValue - 1) * 100 }
        : null,
      rate,
    ),
    toItem("미국채 5년물", ust5y, rate),
    toItem("미국채 10년물", ust10y, rate),
  ].filter((item): item is TickerItem => item !== null);

  if (items.length === 0) return null;

  return (
    <section className="px-6 pt-6">
      <div className="rounded-2xl border border-gray-200 p-3 dark:border-gray-800">
        <HorizontalScrollArrows>
          <div className="flex gap-2">
            {items.map((item) => (
              <MarketCard key={item.label} {...item} />
            ))}
          </div>
        </HorizontalScrollArrows>
      </div>
    </section>
  );
}

function MarketCard({ label, value, delta, up }: TickerItem) {
  const color = up ? "text-red-500" : "text-blue-500";

  return (
    <div className="w-40 shrink-0 rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-900">
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-gray-900 dark:text-gray-100">{value}</p>
      <p className={`text-xs font-semibold ${color}`}>
        {up ? "▲" : "▼"} {delta}
      </p>
    </div>
  );
}
