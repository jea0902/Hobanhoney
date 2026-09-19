import { getYahooQuote } from "@/lib/yahooFinance";
import type { YahooQuote } from "@/lib/yahooFinance";
import { getUst1Y } from "@/lib/fred";

interface TickerItem {
  label: string;
  value: string;
  delta: string;
  up: boolean;
}

function tickerFromYahoo(
  label: string,
  quote: YahooQuote | null,
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

export default async function MarketTicker() {
  const [nasdaq, sp500, kospi, gold, btc, eth, usdt, usdc, ust5y, ust10y, ust1y] =
    await Promise.all([
      getYahooQuote("^IXIC"),
      getYahooQuote("^GSPC"),
      getYahooQuote("^KS11"),
      getYahooQuote("GC=F"),
      getYahooQuote("BTC-USD"),
      getYahooQuote("ETH-USD"),
      getYahooQuote("USDT-USD"),
      getYahooQuote("USDC-USD"),
      getYahooQuote("^FVX"),
      getYahooQuote("^TNX"),
      getUst1Y(),
    ]);

  const ust1yItem: TickerItem | null =
    ust1y && ust1y.previousValue
      ? {
          label: "미국채 1년물",
          value: `${ust1y.value.toFixed(2)}%`,
          delta: `${ust1y.value >= ust1y.previousValue ? "+" : ""}${((ust1y.value / ust1y.previousValue - 1) * 100).toFixed(2)}%`,
          up: ust1y.value >= ust1y.previousValue,
        }
      : null;

  const items = [
    tickerFromYahoo("나스닥종합", nasdaq, (p) =>
      p.toLocaleString("en-US", { maximumFractionDigits: 2 }),
    ),
    tickerFromYahoo("S&P500", sp500, (p) =>
      p.toLocaleString("en-US", { maximumFractionDigits: 2 }),
    ),
    tickerFromYahoo("코스피", kospi, (p) =>
      p.toLocaleString("en-US", { maximumFractionDigits: 2 }),
    ),
    tickerFromYahoo(
      "국제 금",
      gold,
      (p) => `$ ${p.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
    ),
    tickerFromYahoo(
      "비트코인",
      btc,
      (p) => `$ ${p.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
    ),
    tickerFromYahoo(
      "이더리움",
      eth,
      (p) => `$ ${p.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
    ),
    tickerFromYahoo("테더", usdt, (p) => `$ ${p.toFixed(4)}`),
    tickerFromYahoo("USDC", usdc, (p) => `$ ${p.toFixed(4)}`),
    ust1yItem,
    tickerFromYahoo("미국채 5년물", ust5y, (p) => `${p.toFixed(2)}%`),
    tickerFromYahoo("미국채 10년물", ust10y, (p) => `${p.toFixed(2)}%`),
  ].filter((item): item is TickerItem => item !== null);

  if (items.length === 0) return null;

  return (
    <div className="overflow-hidden border-y border-gray-100 bg-white py-4">
      <div className="flex w-max animate-marquee gap-12">
        {[...items, ...items].map((item, index) => (
          <TickerEntry key={index} {...item} />
        ))}
      </div>
    </div>
  );
}

function TickerEntry({ label, value, delta, up }: TickerItem) {
  const color = up ? "text-red-500" : "text-blue-500";

  return (
    <div className="flex shrink-0 items-center gap-2.5 whitespace-nowrap text-base">
      <span className="font-semibold text-gray-700">{label}</span>
      <span className="font-extrabold text-gray-900">{value}</span>
      <span className={`font-bold ${color}`}>
        {up ? "▲" : "▼"} {delta}
      </span>
    </div>
  );
}
