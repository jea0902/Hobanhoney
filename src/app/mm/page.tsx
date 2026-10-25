import type { Metadata } from "next";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import { ALERT_TYPES, alertType, getOiAlerts, summarize } from "@/lib/oiAlerts";
import { getLatestWatchlist, getWatchlistHitRate, getWatchlistResults } from "@/lib/mmWatchlist";
import { getLatestHolderDaily } from "@/lib/holderDaily";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "MM 펌핑 추적 | 호반꿀",
  description:
    "대형 마켓메이커(MM)가 붙은 코인의 펌핑 타이밍을 데이터로 추적하는 프로젝트. 바이낸스 선물 미결제약정 급증 신호와 검증 결과.",
};

const HOUR = 3_600_000;

function formatKst(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function formatPercent(ratio: number | null, digits = 1) {
  if (ratio === null) return "—";
  return `${ratio > 0 ? "+" : ""}${(ratio * 100).toFixed(digits)}%`;
}

// 총발행량 대비 비율 (부호 없이)
function formatShare(ratio: number | null) {
  return ratio === null ? "—" : `${(ratio * 100).toFixed(2)}%`;
}

const CHAIN_NAMES: Record<string, string> = {
  bsc: "BSC",
  eth: "이더리움",
  base: "Base",
  arbitrum: "Arbitrum",
  polygon: "Polygon",
  avalanche: "Avalanche",
  optimism: "Optimism",
  sol: "솔라나",
};

function upDownColor(ratio: number) {
  return ratio >= 0 ? "text-red-500" : "text-blue-500";
}

export default async function MmPage() {
  const rows = await getOiAlerts();
  const alerts = rows.filter((r) => r.kind === "alert");
  const alertStats = summarize(rows, "alert");
  const typeStats = ALERT_TYPES.map((type) => ({
    label: `└ ${type}`,
    stats: summarize(
      rows.filter((r) => r.kind === "alert" && alertType(r) === type),
      "alert",
    ),
  }));
  const controlStats = summarize(rows, "control");
  const now = Date.now();
  const watchlist = await getLatestWatchlist();
  const watchlistHit = await getWatchlistHitRate();
  const watchlistResults = await getWatchlistResults();
  const holders = await getLatestHolderDaily();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Navbar active="mm" />
      <main className="mx-auto max-w-6xl px-6 pb-10 pt-6">
        <h1 className="mb-1 text-base font-bold text-gray-900 dark:text-gray-100 sm:text-lg">
          MM 펌핑 추적
        </h1>
        <p className="mb-6 text-xs leading-relaxed text-gray-500 dark:text-gray-400 sm:text-sm">
          Wintermute·GSR·DWF 같은 대형 마켓메이커(MM)가 붙은 코인의 펌핑 타이밍을 데이터로 추적하는
          프로젝트. 바이낸스 선물 데이터(미결제약정·롱숏 비율)로 펌핑 전 흔적을 찾는 중이고, 다음
          단계로 체인 보유자 쏠림, 마지막으로 의심 날짜만 지갑 이동(Arkham 등)을 확인할 예정.
        </p>

        <h2 className="mb-1 text-base font-bold text-gray-900 dark:text-gray-100 sm:text-lg">
          검증 현황
        </h2>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
          알림 종목과, 같은 시각 OI 급증이 없던 무작위 비교 종목이 72시간 안에 최고가 기준
          +30%·+100%에 닿은 비율을 비교함. 알림 종목 쪽 비율이 꾸준히 높아야 의미 있는 신호임.
          알림은 알림 전 4시간 동안 가장 크게 움직인 폭(4시간 안 최고·최저가 기준)으로 유형을 나눠
          따로 집계함 (조용함 ±5% 이내, 중간 ±5~20%, 급등·급락 20% 초과).
        </p>
        <div className="mb-2 overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 dark:border-gray-800">
                <th className="px-4 py-2.5 text-left font-medium">구분</th>
                <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                  건수
                </th>
                <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                  +30% 도달
                </th>
                <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                  +100% 도달
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "알림 종목", stats: alertStats },
                ...typeStats,
                { label: "비교 종목", stats: controlStats },
              ].map(({ label, stats }) => (
                <tr
                  key={label}
                  className="border-b border-gray-50 last:border-0 dark:border-gray-800"
                >
                  <td className="whitespace-nowrap px-3 py-2.5 text-gray-700 dark:text-gray-300 sm:px-4">
                    {label}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right text-gray-700 dark:text-gray-300 sm:px-3">
                    {stats.count}건
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right text-gray-700 dark:text-gray-300 sm:px-3">
                    {formatPercent(stats.hit30, 0)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right text-gray-700 dark:text-gray-300 sm:px-3">
                    {formatPercent(stats.hit100, 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mb-8 text-xs text-gray-400 dark:text-gray-500">
          2026-10-24 기록 시작. 시작 전 사전 점검(최근 30일, 바이낸스 USDT 무기한 522종목): 아무
          시점의 72시간 안 +100% 비율 0.5% vs 알림 시점 5.9%(34회 중 2회). 표본이 작아 결론 내리지
          않음. 2026-10-25 가격 조건(±5%)을 없앰 — 최근 30일 다시 계산하니 ±5%는 펌핑(72시간 안 고가
          2배) 39번 중 3번만 잡았고 조건이 없으면 31번 (72시간 안 +100% 비율 6.1% → 7.4%, 대신 알림
          5배·72시간 안 최저 중간값 -10.7% → -14.8%).
        </p>

        <h2 className="mb-1 text-base font-bold text-gray-900 dark:text-gray-100 sm:text-lg">
          최근 OI 급증 알림
        </h2>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
          조건: 4시간 동안 OI(달러 기준) +30% 이상, OI 100만 달러 이상. 같은 종목은 24시간에 한 번만
          기록함. 2026-10-25 전에는 ‘4시간 가격 변화 ±5% 이내’ 조건이 있었음 (첫 알림 3건은 그 사이
          급등했다가 되돌아온 경우). 지금은 가격 변화를 조건이 아니라 유형으로 기록하고, 4시간 안
          최고·최저가도 같이 남김.
        </p>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
          OI는 롱과 숏이 항상 같은 양이라 방향을 알 수 없어서 단서를 같이 기록함. 개인 롱/숏 = 롱
          계정 수 ÷ 숏 계정 수, 큰손 롱/숏 = 증거금 상위 20%의 롱 포지션 ÷ 숏 포지션, 테이커 = 직전
          4시간 시장가 매수량 ÷ 매도량 (1보다 크면 사는 쪽이 먼저 들어옴). 2026-10-24 이후 기록부터
          있음.
        </p>
        {alerts.length === 0 ? (
          <p className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            아직 조건에 맞는 종목 없음. 매시 5분마다 확인함.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <table className="w-full min-w-[1260px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 dark:border-gray-800">
                  <th className="px-4 py-2.5 text-left font-medium">시각</th>
                  <th className="px-3 py-2.5 text-left font-medium">종목</th>
                  <th className="px-2 py-2.5 text-left font-medium sm:px-3">유형</th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                    OI
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                    OI 4시간
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                    가격 4시간
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                    4시간 안 최고·최저
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                    펀딩비
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                    개인 롱/숏
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                    큰손 롱/숏
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                    테이커
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                    알림 가격
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                    72시간 안 최고
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                    72시간 안 최저
                  </th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((row) => {
                  const up = row.max_high_72h === null ? null : row.max_high_72h / row.price - 1;
                  const down = row.min_low_72h === null ? null : row.min_low_72h / row.price - 1;
                  const hoursLeft = Math.ceil(
                    (new Date(row.alerted_at).getTime() + 73 * HOUR - now) / HOUR,
                  );
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-gray-50 last:border-0 dark:border-gray-800"
                    >
                      <td className="whitespace-nowrap px-3 py-2.5 text-gray-700 dark:text-gray-300 sm:px-4">
                        {formatKst(row.alerted_at)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 font-medium text-gray-900 dark:text-gray-100 sm:px-3">
                        {row.symbol.replace(/USDT$/, "")}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-gray-700 dark:text-gray-300 sm:px-3">
                        {alertType(row)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right text-gray-700 dark:text-gray-300 sm:px-3">
                        ${(row.oi_usd / 1e6).toFixed(1)}M
                      </td>
                      <td
                        className={`whitespace-nowrap px-2 py-2.5 text-right sm:px-3 ${upDownColor(row.oi_change_4h)}`}
                      >
                        {formatPercent(row.oi_change_4h, 0)}
                      </td>
                      <td
                        className={`whitespace-nowrap px-2 py-2.5 text-right sm:px-3 ${upDownColor(row.price_change_4h)}`}
                      >
                        {formatPercent(row.price_change_4h)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right text-gray-700 dark:text-gray-300 sm:px-3">
                        {row.high_4h === null || row.low_4h === null
                          ? "—"
                          : `${formatPercent(row.high_4h / row.price - 1, 0)} / ${formatPercent(row.low_4h / row.price - 1, 0)}`}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right text-gray-700 dark:text-gray-300 sm:px-3">
                        {row.funding_rate === null ? "—" : formatPercent(row.funding_rate, 4)}
                      </td>
                      {[row.account_ratio, row.top_position_ratio, row.taker_ratio_4h].map(
                        (ratio, i) => (
                          <td
                            key={i}
                            className="whitespace-nowrap px-2 py-2.5 text-right text-gray-700 dark:text-gray-300 sm:px-3"
                          >
                            {ratio === null ? "—" : ratio.toFixed(2)}
                          </td>
                        ),
                      )}
                      <td className="whitespace-nowrap px-2 py-2.5 text-right text-gray-700 dark:text-gray-300 sm:px-3">
                        {Number(row.price.toPrecision(5))}
                      </td>
                      <td
                        className={`whitespace-nowrap px-2 py-2.5 text-right sm:px-3 ${up === null ? "text-gray-400" : upDownColor(up)}`}
                      >
                        {up === null
                          ? `집계 중 (${Math.max(hoursLeft, 1)}시간 뒤)`
                          : formatPercent(up)}
                      </td>
                      <td
                        className={`whitespace-nowrap px-2 py-2.5 text-right sm:px-3 ${down === null ? "text-gray-400" : upDownColor(down)}`}
                      >
                        {down === null ? "—" : formatPercent(down)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <h2 className="mb-1 mt-8 text-base font-bold text-gray-900 dark:text-gray-100 sm:text-lg">
          관찰 후보
        </h2>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
          조건: 직전 60일 개인 롱/숏 평균 2.5 이상, 큰손 롱/숏 평균 1.5 이상, 30일 하루 거래대금
          중간값 100만~2000만 달러. 바이낸스 USDT 무기한 519종목의 400일치 분석에서 이 조합은 30일
          안 펌핑(7일 안 종가 2배) 시작 비율이 약 11%였음 (아무 날 평균 4.9%). 10번 중 1번꼴이라
          매매 신호가 아니라 지켜볼 코인을 좁히는 용도임. 매일 한 번 갱신함.
        </p>
        {watchlist.length === 0 ? (
          <p className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            아직 기록 없음.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 dark:border-gray-800">
                  <th className="px-4 py-2.5 text-left font-medium">종목</th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                    개인 롱/숏
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                    큰손 롱/숏
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                    거래대금
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                    종가
                  </th>
                </tr>
              </thead>
              <tbody>
                {watchlist.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-50 last:border-0 dark:border-gray-800"
                  >
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium text-gray-900 dark:text-gray-100 sm:px-4">
                      {row.symbol.replace(/USDT$/, "")}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-right text-gray-700 dark:text-gray-300 sm:px-3">
                      {row.account_ratio_60d.toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-right text-gray-700 dark:text-gray-300 sm:px-3">
                      {row.top_ratio_60d.toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-right text-gray-700 dark:text-gray-300 sm:px-3">
                      ${(row.volume_30d / 1e6).toFixed(1)}M
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-right text-gray-700 dark:text-gray-300 sm:px-3">
                      {Number(row.price.toPrecision(5))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {watchlist.length > 0 && (
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            {watchlist[0].date} (UTC) 일봉까지 계산, {watchlist.length}종목.
          </p>
        )}

        <h3 className="mb-1 mt-6 text-sm font-bold text-gray-900 dark:text-gray-100 sm:text-base">
          지난 후보 결과
        </h3>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
          후보로 기록된 날로부터 38일이 지나면 결과를 채움 (펌핑한 것과 안 한 것 모두). 펌핑 = 다음
          날부터 30일 안의 어느 날, 그날 종가 대비 이후 7일 안 종가 2배. 최고 종가 = 다음 날부터
          37일 안 가장 높은 종가. 같은 종목이 매일 다시 기록되므로 건수는 날짜 기준임.
          {watchlistHit.done > 0 &&
            ` 지금까지 ${watchlistHit.done}건 중 ${watchlistHit.pumped}건 펌핑 (${((watchlistHit.pumped / watchlistHit.done) * 100).toFixed(1)}%, 분석 때 약 11%·전체 평균 4.9%).`}
        </p>
        {watchlistResults.length === 0 ? (
          <p className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            첫 결과는 2026-12-01 무렵부터 나옴 (2026-10-23 후보 + 38일).
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 dark:border-gray-800">
                  <th className="px-4 py-2.5 text-left font-medium">기준일</th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-left font-medium sm:px-3">
                    종목
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                    개인 롱/숏
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                    큰손 롱/숏
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                    종가
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                    37일 안 최고 종가
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                    30일 안 펌핑
                  </th>
                </tr>
              </thead>
              <tbody>
                {watchlistResults.map((row) => {
                  const best =
                    row.max_close_37d === null ? null : row.max_close_37d / row.price - 1;
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-gray-50 last:border-0 dark:border-gray-800"
                    >
                      <td className="whitespace-nowrap px-3 py-2.5 text-gray-700 dark:text-gray-300 sm:px-4">
                        {row.date}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 font-medium text-gray-900 dark:text-gray-100 sm:px-3">
                        {row.symbol.replace(/USDT$/, "")}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right text-gray-700 dark:text-gray-300 sm:px-3">
                        {row.account_ratio_60d.toFixed(2)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right text-gray-700 dark:text-gray-300 sm:px-3">
                        {row.top_ratio_60d.toFixed(2)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right text-gray-700 dark:text-gray-300 sm:px-3">
                        {Number(row.price.toPrecision(5))}
                      </td>
                      <td
                        className={`whitespace-nowrap px-2 py-2.5 text-right sm:px-3 ${best === null ? "text-gray-400" : upDownColor(best)}`}
                      >
                        {formatPercent(best)}
                      </td>
                      <td
                        className={`whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3 ${row.pumped_30d ? "text-red-500" : "text-gray-400"}`}
                      >
                        {row.pumped_30d ? "펌핑" : "아님"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <h2 className="mb-1 mt-8 text-base font-bold text-gray-900 dark:text-gray-100 sm:text-lg">
          체인 보유자 쏠림
        </h2>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
          관찰 후보와 OI 급증 알림 코인의 토큰을
          BSC·이더리움·Base·Arbitrum·Polygon·Avalanche·Optimism·솔라나에서 추적함. 여러 체인에 있는
          토큰은 실제 거래가 어느 쪽인지 몰라서 체인마다 따로 표시함. 상위 지갑은 모두{" "}
          <span className="font-medium">상위 100개 지갑</span>이고, 컨트랙트(DEX 풀·브리지·거래소
          컨트랙트 등)는 빼고 셈.
        </p>
        <ul className="mb-3 list-disc space-y-1 pl-5 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
          <li>
            순매집 상위 100 = 추적 시작 뒤 (받은 양 − 보낸 양)이 가장 큰 지갑 100개의 순매집 합 ÷
            총발행량. 그 옆 칸은 이 100개 지갑의 지금 잔고 합 ÷ 총발행량.
          </li>
          <li>잔고 상위 100 = 지금 가장 많이 들고 있는 지갑 100개의 잔고 합 ÷ 총발행량.</li>
          <li>
            솔라나 외 체인은 과거 이체 기록을 무료로 받을 수 없어서 15분마다 새 이체를 쌓는
            방식이라, 추적 시작 전부터 가만히 들고 있던 지갑은 움직이기 전까지 안 보임. 솔라나는
            보유자 전체 목록을 매일 받아 첫날 목록과 비교함.
          </li>
        </ul>
        {holders.length === 0 ? (
          <p className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            2026-10-25 추적 시작. 첫 하루 요약은 다음 날 새벽(UTC)에 기록됨.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 dark:border-gray-800">
                  <th className="px-4 py-2.5 text-left font-medium">종목</th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-left font-medium sm:px-3">
                    체인
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                    순매집 상위 100
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                    그 지갑 잔고
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                    잔고 상위 100
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                    새 지갑
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                    움직인 지갑
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5 text-right font-medium sm:px-3">
                    추적 시작
                  </th>
                </tr>
              </thead>
              <tbody>
                {holders.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-50 last:border-0 dark:border-gray-800"
                  >
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium text-gray-900 dark:text-gray-100 sm:px-4">
                      {row.symbol.replace(/USDT$/, "")}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-gray-700 dark:text-gray-300 sm:px-3">
                      {CHAIN_NAMES[row.chain] ?? row.chain}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-right text-gray-700 dark:text-gray-300 sm:px-3">
                      {formatShare(row.net100_pct)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-right text-gray-700 dark:text-gray-300 sm:px-3">
                      {formatShare(row.net100_balance_pct)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-right text-gray-700 dark:text-gray-300 sm:px-3">
                      {formatShare(row.holder100_pct)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-right text-gray-700 dark:text-gray-300 sm:px-3">
                      {row.new_wallets.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-right text-gray-700 dark:text-gray-300 sm:px-3">
                      {row.active_wallets.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-right text-gray-700 dark:text-gray-300 sm:px-3">
                      {row.tracked_since}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {holders.length > 0 && (
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            {holders[0].date} (UTC) 하루 기준, {holders.length}행 (종목 × 체인).
          </p>
        )}

        <h2 className="mb-1 mt-8 text-base font-bold text-gray-900 dark:text-gray-100 sm:text-lg">
          진행 계획
        </h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-gray-600 dark:text-gray-400 sm:text-sm">
          <li>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              선물 데이터 (진행 중)
            </span>{" "}
            — OI 급증 알림과 관찰 후보를 쌓아서, 비교 종목·전체 평균보다 실제로 더 자주 펌핑하는지
            확인.
          </li>
          <li>
            <span className="font-medium text-gray-900 dark:text-gray-100">체인 보유자 쏠림</span> —
            펌핑 전 상위 지갑 보유 비중, 거래소로 들어가는 물량 변화 확인.
          </li>
          <li>
            <span className="font-medium text-gray-900 dark:text-gray-100">지갑 이동 확인</span> —
            앞 단계에서 의심스러운 날짜만 Arkham·Bubblemaps로 MM 지갑 이동 확인.
          </li>
        </ol>
        <p className="mt-6 text-xs text-gray-400 dark:text-gray-500">
          검증 중인 신호이며 투자 권유가 아님. 펌핑 코인은 급등만큼 급락도 빠름.
        </p>
      </main>
      <Footer />
    </div>
  );
}
