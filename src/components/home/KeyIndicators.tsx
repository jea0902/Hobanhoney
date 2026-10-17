import { getYahooQuote } from "@/lib/yahooFinance";
import type { YahooQuote } from "@/lib/yahooFinance";
import { getCryptoFearGreed } from "@/lib/alternativeMe";
import { getBtcDominance } from "@/lib/coingecko";
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
  hint?: string; // 이름 아래 한 줄 설명
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
    btcDominance,
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
    getBtcDominance(),
  ]);

  const percentPoint = (d: number) => `${d >= 0 ? "+" : ""}${d.toFixed(2)}%p`;
  const groups: { title: string; items: IndicatorDisplay[] }[] = [
    {
      title: "시장 심리",
      items: [
        { ...fromYahoo("VIX", vix, (q) => q.price.toFixed(2)), hint: "높을수록 주식 시장 불안" },
        {
          label: "공포탐욕지수 (코인)",
          value: fearGreed ? `${fearGreed.value} · ${fearGreed.classification}` : "—",
          delta: fearGreed
            ? `${fearGreed.changeFromYesterday >= 0 ? "+" : ""}${fearGreed.changeFromYesterday}`
            : "",
          up: fearGreed ? fearGreed.changeFromYesterday >= 0 : true,
        },
        {
          label: "비트코인 도미넌스",
          value: btcDominance === null ? "—" : `${btcDominance.toFixed(2)}%`,
          delta: "",
          up: true,
          hint: "내려가면 알트코인으로 돈이 옮겨가는 신호",
        },
      ],
    },
    {
      title: "금리·달러",
      items: [
        fromFred("연준 기준금리", fedFunds, (v) => `${v.toFixed(2)}%`, percentPoint),
        fromYahoo("미국 10년물 국채금리", us10y, (q) => `${q.price.toFixed(2)}%`),
        {
          ...fromFred(
            "신용스프레드 (하이일드)",
            creditSpread,
            (v) => `${v.toFixed(2)}%p`,
            percentPoint,
          ),
          hint: "벌어질수록 기업 부도 위험이 큼",
        },
        {
          ...fromYahoo("달러인덱스 (DXY)", dxy, (q) => q.price.toFixed(2)),
          hint: "주요 6개국 통화 대비 달러 가치",
        },
      ],
    },
    {
      title: "경기·물가",
      items: [
        fromFred("CPI (전년동월비)", cpiYoy, (v) => `${v.toFixed(2)}%`, percentPoint),
        fromFred("PCE (전년동월비)", pceYoy, (v) => `${v.toFixed(2)}%`, percentPoint),
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
      ],
    },
  ];

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-gray-100">주요 지표</h2>
      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="mb-1 text-xs font-semibold text-gray-400">{group.title}</p>
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {group.items.map((item) => (
                <IndicatorRow key={item.label} {...item} />
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-gray-400">
        출처: Yahoo Finance, FRED, alternative.me, CoinGecko
      </p>
    </div>
  );
}

// 네이버 증권 "인기" 목록처럼 이름은 왼쪽, 값과 변동은 오른쪽에 둔다.
function IndicatorRow({ label, value, delta, up, hint }: IndicatorDisplay) {
  const color = up ? "text-red-500" : "text-blue-500";

  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-200">{label}</p>
        {hint && <p className="truncate text-[11px] text-gray-400">{hint}</p>}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-base font-bold text-gray-900 dark:text-gray-100">{value}</p>
        {delta && (
          <p className={`text-xs font-semibold ${color}`}>
            {up ? "▲" : "▼"} {delta}
          </p>
        )}
      </div>
    </li>
  );
}
