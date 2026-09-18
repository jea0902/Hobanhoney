import { getYahooQuote } from "@/lib/yahooFinance";
import type { YahooQuote } from "@/lib/yahooFinance";
import { getCryptoFearGreed } from "@/lib/alternativeMe";

interface IndicatorDisplay {
  label: string;
  value: string;
  delta: string;
  up: boolean;
}

function toIndicator(
  label: string,
  quote: YahooQuote | null,
  formatValue: (q: YahooQuote) => string,
): IndicatorDisplay {
  if (!quote) {
    return { label, value: "—", delta: "", up: true };
  }
  return {
    label,
    value: formatValue(quote),
    delta: `${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%`,
    up: quote.changePercent >= 0,
  };
}

export default async function KeyIndicators() {
  const [vix, dxy, us10y, fearGreed] = await Promise.all([
    getYahooQuote("^VIX"),
    getYahooQuote("DX-Y.NYB"),
    getYahooQuote("^TNX"),
    getCryptoFearGreed(),
  ]);

  const items: IndicatorDisplay[] = [
    toIndicator("VIX", vix, (q) => q.price.toFixed(2)),
    toIndicator("달러인덱스 (DXY)", dxy, (q) => q.price.toFixed(2)),
    toIndicator("미국 10년물 국채금리", us10y, (q) => `${q.price.toFixed(2)}%`),
    {
      label: "공포탐욕지수 (코인)",
      value: fearGreed ? `${fearGreed.value} · ${fearGreed.classification}` : "—",
      delta: fearGreed
        ? `${fearGreed.changeFromYesterday >= 0 ? "+" : ""}${fearGreed.changeFromYesterday}`
        : "",
      up: fearGreed ? fearGreed.changeFromYesterday >= 0 : true,
    },
  ];

  return (
    <section className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900">
          주요 지표 <span className="text-gray-300">→</span>
        </h2>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {items.map((item) => (
            <IndicatorCard key={item.label} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function IndicatorCard({ label, value, delta, up }: IndicatorDisplay) {
  const color = up ? "text-red-500" : "text-blue-500";

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${up ? "bg-red-400" : "bg-blue-400"}`} />
        <p className="truncate text-xs text-gray-400">{label}</p>
      </div>
      <p className="mt-2 truncate text-lg font-extrabold text-gray-900">{value}</p>
      {delta && (
        <p className={`text-xs font-semibold ${color}`}>
          {up ? "▲" : "▼"} {delta}
        </p>
      )}
    </div>
  );
}
