import { getYahooQuote } from "@/lib/yahooFinance";
import { getKoreaBond3Y } from "@/lib/naverStock";
import { getSeoulApartmentIndex } from "@/lib/ecosHousing";

interface Tile {
  label: string;
  value: string; // 실제 가격 (채권은 금리 수준)
  delta: string; // 등락 문구
  change: number; // 색과 진하기를 정하는 값. 채권은 금리가 내릴 때(= 채권 가격이 오를 때) 양수.
  note?: string; // 맨 아래 작은 글씨
  hint?: string; // 마우스를 올리면 보이는 설명
  isOpen?: boolean | null; // 주식 지수만
}

const LEVEL_CLASSES = {
  up: ["bg-gray-100 dark:bg-gray-900", "bg-red-500/10", "bg-red-500/20", "bg-red-500/35"],
  down: ["bg-gray-100 dark:bg-gray-900", "bg-blue-500/10", "bg-blue-500/20", "bg-blue-500/35"],
};

// 등락 폭이 클수록 진하게. 글을 읽지 않아도 오늘 어느 쪽으로 쏠렸는지 색으로 보이게 한다.
function tileColor(change: number) {
  const size = Math.abs(change);
  const level = size < 0.3 ? 0 : size < 1 ? 1 : size < 2 ? 2 : 3;
  return LEVEL_CLASSES[change >= 0 ? "up" : "down"][level];
}

const index = (price: number) => price.toLocaleString("en-US", { maximumFractionDigits: 2 });
const usd = (price: number) =>
  `$${price.toLocaleString("en-US", { maximumFractionDigits: price >= 1000 ? 0 : price >= 10 ? 2 : 4 })}`;

function percent(value: number) {
  return `${value >= 0 ? "▲" : "▼"}${Math.abs(value).toFixed(2)}%`;
}

function priceTile(
  label: string,
  quote: { price: number; changePercent: number } | null,
  format: (price: number) => string,
  extra: Pick<Tile, "isOpen" | "note"> = {},
): Tile | null {
  return (
    quote && {
      label,
      value: format(quote.price),
      delta: percent(quote.changePercent),
      change: quote.changePercent,
      ...extra,
    }
  );
}

// 금리가 전날보다 몇 %p 움직였는지. 야후·네이버 모두 금리 자체의 등락률(%)을 주므로 거꾸로 계산한다.
function yieldChangePoint(rate: number, changePercent: number) {
  return rate - rate / (1 + changePercent / 100);
}

function bondTile(label: string, rate: number, changePercent: number): Tile {
  const point = yieldChangePoint(rate, changePercent);
  return {
    label,
    value: `${rate.toFixed(2)}%`,
    delta: `${point >= 0 ? "+" : "−"}${Math.abs(point).toFixed(2)}%p`,
    note: `금리 ${point >= 0 ? "상승" : "하락"}`,
    // 금리가 내리면 채권 가격이 오르므로 빨강. 금리는 0.1%p만 움직여도 큰 날이라 주식 1%와 비슷한 진하기가 되게 10배로 맞춤.
    change: -point * 10,
    hint: "금리가 내리면 채권 가격이 올라 빨강, 금리가 오르면 파랑",
  };
}

export default async function MarketOverview() {
  const [nasdaq, sp500, kospi, nikkei, shanghai, stoxx, btc, eth] = await Promise.all([
    getYahooQuote("^IXIC"),
    getYahooQuote("^GSPC"),
    getYahooQuote("^KS11"),
    getYahooQuote("^N225"),
    getYahooQuote("000001.SS"),
    getYahooQuote("^STOXX"),
    getYahooQuote("BTC-USD"),
    getYahooQuote("ETH-USD"),
  ]);
  const [gold, dxy, usdKrw, ust10y, kr3y, wti, brent, gas, seoulApt] = await Promise.all([
    getYahooQuote("GC=F"),
    getYahooQuote("DX-Y.NYB"),
    getYahooQuote("KRW=X"),
    getYahooQuote("^TNX"),
    getKoreaBond3Y(),
    getYahooQuote("CL=F"),
    getYahooQuote("BZ=F"),
    getYahooQuote("NG=F"),
    getSeoulApartmentIndex(),
  ]);

  const stocks = [
    priceTile("나스닥종합", nasdaq, index, { isOpen: nasdaq?.isOpen }),
    priceTile("S&P500", sp500, index, { isOpen: sp500?.isOpen }),
    priceTile("코스피", kospi, index, { isOpen: kospi?.isOpen }),
    priceTile("닛케이", nikkei, index, { isOpen: nikkei?.isOpen }),
    priceTile("상하이종합", shanghai, index, { isOpen: shanghai?.isOpen }),
    priceTile("유럽 Stoxx600", stoxx, index, { isOpen: stoxx?.isOpen }),
    priceTile("비트코인", btc, usd),
    priceTile("이더리움", eth, usd),
  ];

  const safe = [
    priceTile("금 선물", gold, usd),
    priceTile("달러인덱스", dxy, index, {
      note: usdKrw
        ? `원/달러 ${usdKrw.price.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}원`
        : undefined,
    }),
    ust10y && bondTile("미국채 10년", ust10y.price, ust10y.changePercent),
    kr3y && bondTile("한국채 3년", kr3y.value, kr3y.changePercent),
  ];

  const commodities = [
    priceTile("WTI 원유", wti, usd),
    priceTile("브렌트유", brent, usd),
    priceTile("천연가스", gas, usd),
  ];

  // 월간 통계라 하루 등락이 아니라 전월 대비 변화
  const housing = [
    seoulApt && {
      label: "서울 아파트 (월간)",
      value: seoulApt.value.toFixed(2),
      delta: percent(seoulApt.changePercent),
      change: seoulApt.changePercent,
      note: `${seoulApt.month.slice(0, 4)}.${seoulApt.month.slice(4)} 기준 · 전월 대비`,
    },
  ];

  // 위 한 줄(주식·코인)은 위험자산(주황), 아래 줄은 안전자산(하늘) | 원자재(연두) | 부동산(보라)을 구분선으로 나눈다.
  // 아래 줄은 칸이 8개라 폭이 1400px 이상일 때만 한 줄로 놓고, 그보다 좁으면 위아래로 쌓는다.
  return (
    <section className="flex flex-col gap-2 px-6 pt-6">
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-2">
        <TileGrid tiles={stocks} mode="wide" />
      </div>
      <div className="flex flex-col divide-y divide-gray-700/70 overflow-hidden rounded-2xl border border-gray-700/70 min-[1400px]:flex-row min-[1400px]:divide-x min-[1400px]:divide-y-0">
        <Section
          tone="safe"
          grow="min-[1400px]:flex-[4_1_0%]"
          columns="min-[1400px]:grid-cols-4"
          tiles={safe}
        />
        <Section
          tone="commodity"
          grow="min-[1400px]:flex-[3_1_0%]"
          columns="min-[1400px]:grid-cols-3"
          tiles={commodities}
        />
        <Section
          tone="housing"
          grow="min-[1400px]:flex-[1_1_0%]"
          columns="min-[1400px]:grid-cols-1"
          tiles={housing}
        />
      </div>
    </section>
  );
}

const SECTION_TONES = {
  safe: "bg-sky-500/5",
  commodity: "bg-emerald-500/5",
  housing: "bg-violet-500/5",
};

function Section({
  tone,
  grow,
  columns,
  tiles,
}: {
  tone: keyof typeof SECTION_TONES;
  grow: string;
  columns: string;
  tiles: (Tile | null | undefined | false)[];
}) {
  return (
    <div className={`min-w-0 p-2 ${SECTION_TONES[tone]} ${grow}`}>
      <TileGrid tiles={tiles} mode="narrow" columns={columns} />
    </div>
  );
}

// 칸 최소 폭을 정해 두고 들어갈 만큼 채움 — 가격이 "..."로 잘리지 않게 하려고 열 수를 고정하지 않음.
// wide(첫 줄): 지수 가격(63,290.11)이 가장 길어서 넓게(8rem), auto-fit이라 빈 열이 없어 8칸이 폭을 꽉 채움
//   (auto-fill이면 빈 열이 생겨 칸이 좁아져 가격이 잘린다).
// narrow(아래 줄): 값이 짧아서 좁게(7.5rem). 한 줄로 놓는 폭(1400px 이상)에서는 columns로 칸 수를 고정해
//   묶음마다 칸 폭이 같게(칸 8개가 폭을 균등하게 나눠 가짐) 한다.
const GRID_MODES = {
  wide: "grid-cols-[repeat(auto-fit,minmax(8rem,1fr))]",
  narrow: "grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))]",
};

function TileGrid({
  tiles,
  mode,
  columns = "",
}: {
  tiles: (Tile | null | undefined | false)[];
  mode: keyof typeof GRID_MODES;
  columns?: string;
}) {
  return (
    <div className={`grid gap-1.5 ${GRID_MODES[mode]} ${columns}`}>
      {tiles.map((tile) => tile && <TileBox key={tile.label} tile={tile} />)}
    </div>
  );
}

function TileBox({ tile }: { tile: Tile }) {
  const color = tile.change >= 0 ? "text-red-500" : "text-blue-500";

  return (
    <div title={tile.hint} className={`rounded-lg px-2.5 py-2 ${tileColor(tile.change)}`}>
      <div className="flex items-center justify-between gap-1">
        <p className="truncate text-[11px] font-semibold text-gray-700 dark:text-gray-300">
          {tile.label}
        </p>
        {tile.isOpen !== undefined && tile.isOpen !== null && (
          <span
            className={`shrink-0 text-[10px] font-semibold ${tile.isOpen ? "text-green-500" : "text-gray-500"}`}
          >
            {tile.isOpen ? "장중" : "마감"}
          </span>
        )}
      </div>
      <div className="flex items-baseline justify-between gap-1">
        <p className="truncate text-sm font-extrabold text-gray-900 dark:text-gray-100">
          {tile.value}
        </p>
        <p className={`shrink-0 text-[11px] font-semibold ${color}`}>{tile.delta}</p>
      </div>
      {tile.note && <p className="truncate text-[10px] text-gray-400">{tile.note}</p>}
    </div>
  );
}
