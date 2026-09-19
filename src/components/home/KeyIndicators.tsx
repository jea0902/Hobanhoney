import { getYahooQuote } from "@/lib/yahooFinance";
import type { YahooQuote } from "@/lib/yahooFinance";
import { getCryptoFearGreed } from "@/lib/alternativeMe";
import {
  getFedFundsRate,
  getCpiYoy,
  getPceYoy,
  getNonfarmPayrollChange,
  getUnemploymentRate,
  getCreditSpread,
} from "@/lib/fred";
import type { FredValue } from "@/lib/fred";

interface IndicatorDisplay {
  label: string;
  value: string;
  delta: string;
  up: boolean;
  source?: string;
  description?: string;
}

function fromYahoo(
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

// FRED 지표는 %/%p 단위 그대로 쓰는 것과, "천 명" 같은 별도 단위를 쓰는 것이 섞여 있어
// 델타 포맷터를 직접 넘겨받는다.
function fromFred(
  label: string,
  data: FredValue | null,
  formatValue: (v: number) => string,
  formatDelta: (diff: number) => string,
): IndicatorDisplay {
  if (!data) {
    return { label, value: "—", delta: "", up: true };
  }
  const diff = data.previousValue === null ? 0 : data.value - data.previousValue;
  return {
    label,
    value: formatValue(data.value),
    delta: data.previousValue === null ? "" : formatDelta(diff),
    up: diff >= 0,
    source: "FRED",
  };
}

export default async function KeyIndicators() {
  const [
    vix,
    dxy,
    us10y,
    fearGreed,
    fedFunds,
    cpiYoy,
    pceYoy,
    nonfarmPayroll,
    unemploymentRate,
    creditSpread,
  ] = await Promise.all([
    getYahooQuote("^VIX"),
    getYahooQuote("DX-Y.NYB"),
    getYahooQuote("^TNX"),
    getCryptoFearGreed(),
    getFedFundsRate(),
    getCpiYoy(),
    getPceYoy(),
    getNonfarmPayrollChange(),
    getUnemploymentRate(),
    getCreditSpread(),
  ]);

  const items: IndicatorDisplay[] = [
    {
      ...fromYahoo("VIX", vix, (q) => q.price.toFixed(2)),
      description: "주식판 공포탐욕지수 · 높을수록 시장 불안 심리가 큼",
    },
    {
      ...fromYahoo("달러인덱스 (DXY)", dxy, (q) => q.price.toFixed(2)),
      description: "주요 6개국 통화 대비 달러 가치를 나타내는 지수",
    },
    fromYahoo("미국 10년물 국채금리", us10y, (q) => `${q.price.toFixed(2)}%`),
    {
      label: "공포탐욕지수 (코인)",
      value: fearGreed ? `${fearGreed.value} · ${fearGreed.classification}` : "—",
      delta: fearGreed
        ? `${fearGreed.changeFromYesterday >= 0 ? "+" : ""}${fearGreed.changeFromYesterday}`
        : "",
      up: fearGreed ? fearGreed.changeFromYesterday >= 0 : true,
    },
    fromFred(
      "연준 기준금리",
      fedFunds,
      (v) => `${v.toFixed(2)}%`,
      (d) => `${d >= 0 ? "+" : ""}${d.toFixed(2)}%p`,
    ),
    fromFred(
      "CPI (전년동월비)",
      cpiYoy,
      (v) => `${v.toFixed(2)}%`,
      (d) => `${d >= 0 ? "+" : ""}${d.toFixed(2)}%p`,
    ),
    fromFred(
      "PCE (전년동월비)",
      pceYoy,
      (v) => `${v.toFixed(2)}%`,
      (d) => `${d >= 0 ? "+" : ""}${d.toFixed(2)}%p`,
    ),
    fromFred(
      "비농업고용 증감",
      nonfarmPayroll,
      (v) => `${v >= 0 ? "+" : ""}${v.toLocaleString("en-US")}K`,
      (d) => `전월 대비 ${d >= 0 ? "+" : ""}${d.toFixed(0)}K`,
    ),
    fromFred(
      "실업률",
      unemploymentRate,
      (v) => `${v.toFixed(1)}%`,
      (d) => `${d >= 0 ? "+" : ""}${d.toFixed(1)}%p`,
    ),
    fromFred(
      "신용스프레드 (하이일드)",
      creditSpread,
      (v) => `${v.toFixed(2)}%p`,
      (d) => `${d >= 0 ? "+" : ""}${d.toFixed(2)}%p`,
    ),
  ];

  return (
    <section className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900">
          주요 지표 <span className="text-gray-300">→</span>
        </h2>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((item) => (
            <IndicatorCard key={item.label} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function IndicatorCard({ label, value, delta, up, source, description }: IndicatorDisplay) {
  const color = up ? "text-red-500" : "text-blue-500";

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${up ? "bg-red-400" : "bg-blue-400"}`} />
        <p className="truncate text-xs text-gray-400">{label}</p>
      </div>
      <p className="mt-2 truncate text-lg font-extrabold text-gray-900">{value}</p>
      {delta && (
        <p className={`truncate text-xs font-semibold ${color}`}>
          {up ? "▲" : "▼"} {delta}
        </p>
      )}
      {description && (
        <p className="mt-1.5 text-[10px] leading-snug text-gray-400">{description}</p>
      )}
      {source && <p className="mt-1 text-[10px] text-gray-300">출처: {source}</p>}
    </div>
  );
}
