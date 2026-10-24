import type { Metadata } from "next";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import { getOiAlerts, summarize } from "@/lib/oiAlerts";

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

function upDownColor(ratio: number) {
  return ratio >= 0 ? "text-red-500" : "text-blue-500";
}

export default async function MmPage() {
  const rows = await getOiAlerts();
  const alerts = rows.filter((r) => r.kind === "alert");
  const alertStats = summarize(rows, "alert");
  const controlStats = summarize(rows, "control");
  const now = Date.now();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Navbar active="mm" />
      <main className="mx-auto max-w-6xl px-6 pb-10 pt-6">
        <h1 className="mb-1 text-base font-bold text-gray-900 dark:text-gray-100 sm:text-lg">
          MM 펌핑 추적
        </h1>
        <p className="mb-6 text-xs leading-relaxed text-gray-500 dark:text-gray-400 sm:text-sm">
          Wintermute·GSR·DWF 같은 대형 마켓메이커(MM)가 붙은 코인의 펌핑 타이밍을 데이터로 추적하는
          프로젝트. 1단계로 바이낸스 선물 미결제약정(OI) 급증을 매시간 기록하고, 이 신호가 실제로
          펌핑을 앞서는지 검증 중임. 블록체인 지갑 추적(Arkham 등)은 손 검증을 거친 뒤 추가 예정.
        </p>

        <h2 className="mb-1 text-base font-bold text-gray-900 dark:text-gray-100 sm:text-lg">
          검증 현황
        </h2>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
          알림 종목과, 같은 시각 OI 급증이 없던 무작위 비교 종목이 72시간 안에 최고가 기준
          +30%·+100%에 닿은 비율을 비교함. 알림 종목 쪽 비율이 꾸준히 높아야 의미 있는 신호임.
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
          않음.
        </p>

        <h2 className="mb-1 text-base font-bold text-gray-900 dark:text-gray-100 sm:text-lg">
          최근 OI 급증 알림
        </h2>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
          조건: 4시간 동안 OI(달러 기준) +30% 이상, 4시간 전 대비 지금 가격 변화 ±5% 이내, OI 100만
          달러 이상. 같은 종목은 24시간에 한 번만 기록함. 가격 변화는 시작과 끝만 비교해서, 그 사이
          급등했다가 되돌아온 경우도 포함됨 (첫 알림 3건 모두 이 경우) → 4시간 안 최고·최저가를 같이
          기록해 조용히 쌓인 경우와 나눠 볼 예정.
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
            <table className="w-full min-w-[1180px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 dark:border-gray-800">
                  <th className="px-4 py-2.5 text-left font-medium">시각</th>
                  <th className="px-3 py-2.5 text-left font-medium">종목</th>
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
          진행 계획
        </h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-gray-600 dark:text-gray-400 sm:text-sm">
          <li>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              OI 급증 신호 (진행 중)
            </span>{" "}
            — 2~4주 기록 후 알림 종목과 비교 종목의 결과 비교.
          </li>
          <li>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              MM 지갑 신호 손 검증
            </span>{" "}
            — 7일 안 +100% 오른 코인 15~20개와, 같은 시기 상장했지만 오르지 않은 코인 15~20개를
            비교. 펌핑 전 60일 동안 프로젝트 지갑 → MM 지갑 이동, 거래소 ↔ MM 지갑 입출금을
            Arkham으로 확인.
          </li>
          <li>
            <span className="font-medium text-gray-900 dark:text-gray-100">자동 추적</span> — 검증을
            통과한 신호만 MM 지갑 목록으로 자동 수집해 이 화면에 표시.
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
