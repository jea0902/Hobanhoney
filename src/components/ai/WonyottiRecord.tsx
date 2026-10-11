import WonyottiBalanceChart from "@/components/ai/WonyottiBalanceChart";
import record from "@/lib/wonyottiRecord.json";

// AI 워뇨띠 상세 페이지 전용: 워뇨띠 실제 기록 요약과, AI가 닮지 못한 부분에 대한 설명.
// 숫자는 scripts/wonyotti-record.ts가 원본 CSV(로컬 전용)에서 만든 src/lib/wonyottiRecord.json.

function formatBtc(n: number, digits = 1) {
  return `${n.toLocaleString("en-US", { maximumFractionDigits: digits })} BTC`;
}

function signedBtc(n: number, digits = 1) {
  return `${n > 0 ? "+" : ""}${formatBtc(n, digits)}`;
}

function pnlColor(n: number) {
  return n >= 0 ? "text-red-500" : "text-blue-500";
}

const card =
  "rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900";
const th = "px-4 py-3 font-medium";
const td = "whitespace-nowrap px-4 py-2.5";

export default function WonyottiRecord() {
  const { totals, habits } = record;
  const habitRows: [string, string][] = [
    [
      "주문 방식",
      `지정가 ${habits.limitShare}% (체결의 ${habits.makerShare}%가 호가에 걸어두고 기다린 체결)`,
    ],
    [
      "포지션 수",
      `${habits.positions.toLocaleString()}개 (롱 ${habits.longShare}%, 방향 편향 없음)`,
    ],
    ["승률", `${habits.winRate}%`],
    ["평균 이익 / 평균 손실", `${formatBtc(habits.avgWin, 2)} / ${formatBtc(habits.avgLoss, 2)}`],
    ["보유 시간 중간값", `${habits.medianHoldMinutes}분`],
    ["이긴 포지션의 가격 움직임 중간값", `${habits.medianWinMove}%`],
    ["물타기·불타기한 포지션", `${habits.addedShare}%`],
    ["스탑 주문이 체결된 포지션", `${habits.stopPositions}개 (손절은 대부분 직접 지정가로)`],
    ["강제청산된 포지션", `${habits.liquidationPositions}개 (모두 2018년)`],
  ];

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
          워뇨띠 실제 기록 ({record.period.from.slice(0, 7)} ~ {record.period.to.slice(0, 7)},
          BitMEX)
        </h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          BitMEX 계정(aoa)의 체결 {habits.fills.toLocaleString()}건과 지갑 기록을 분석함. 손익은 BTC
          기준이며, 포지션 분석은 거래의 대부분을 차지한 BTC 무기한(XBTUSD) 기준임.
        </p>
      </div>

      <div
        className={`${card} border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30`}
      >
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
          AI 워뇨띠가 닮지 못한 것
        </h3>
        <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-6 text-gray-700 dark:text-gray-300">
          <li>
            AI 워뇨띠는 위 기록에서 승률·익절 폭·물타기·보유 시간 같은 매매 습관을 뽑아 만든 규칙임.
          </li>
          <li>
            워뇨띠 수익의 핵심인 &ldquo;언제 크게 실을지 고르는 판단&rdquo;은 구현하지 못함. 이익
            상위 1% 포지션({habits.top1Count}개)이 BTC 무기한 총이익의 {habits.top1Share}%를 냈고,
            나머지 99%는 합치면 소폭 손실임.
          </li>
          <li>호가창을 보며 지정가로 나눠 사고파는 판단도 1시간봉 규칙으로는 재현할 수 없음.</li>
          <li>
            같은 규칙을 과거 시세로 시험한 결과도 손실이었음 (레버리지 2배 기준 2018~2021년 연 -32%,
            2022~2026년 연 -12%). 습관만으로는 수익이 나지 않는다는 비교 대상으로 운영함.
          </li>
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["입금 (2018년 전부)", formatBtc(totals.deposits)],
          ["실현 손익", signedBtc(totals.realizedPnl, 0)],
          ["출금", formatBtc(totals.withdrawals, 0)],
          ["2021년 말 잔고", formatBtc(totals.endBalance, 0)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <p className="text-xs text-gray-400">{label}</p>
            <p className="mt-1 text-lg font-extrabold text-gray-900 dark:text-gray-100">{value}</p>
          </div>
        ))}
      </div>

      <WonyottiBalanceChart monthly={record.monthly} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 dark:border-gray-800">
                <th className={`${th} text-left`}>연도</th>
                <th className={`${th} text-right`}>실현 손익</th>
                <th className={`${th} text-right`}>출금</th>
              </tr>
            </thead>
            <tbody>
              {record.yearly.map((row) => (
                <tr
                  key={row.year}
                  className="border-b border-gray-50 last:border-0 dark:border-gray-800"
                >
                  <td className={`${td} font-semibold text-gray-900 dark:text-gray-100`}>
                    {row.year}
                  </td>
                  <td className={`${td} text-right font-bold ${pnlColor(row.pnl)}`}>
                    {signedBtc(row.pnl)}
                  </td>
                  <td className={`${td} text-right text-gray-700 dark:text-gray-300`}>
                    {formatBtc(row.withdrawn)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 dark:border-gray-800">
                <th className={`${th} text-left`}>종목</th>
                <th className={`${th} text-right`}>실현 손익</th>
              </tr>
            </thead>
            <tbody>
              {record.bySymbol.map((row) => (
                <tr
                  key={row.symbol}
                  className="border-b border-gray-50 last:border-0 dark:border-gray-800"
                >
                  <td className={`${td} font-semibold text-gray-900 dark:text-gray-100`}>
                    {row.symbol}
                  </td>
                  <td className={`${td} text-right font-bold ${pnlColor(row.pnl)}`}>
                    {signedBtc(row.pnl)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={card}>
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
          매매 습관 (BTC 무기한)
        </h3>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {habitRows.map(([label, value]) => (
            <div
              key={label}
              className="flex justify-between gap-4 border-b border-gray-50 pb-2 dark:border-gray-800"
            >
              <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
              <dd className="text-right font-semibold text-gray-900 dark:text-gray-100">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <p className="px-4 pt-4 text-sm font-bold text-gray-900 dark:text-gray-100">
          보유 시간별 성과 — 초단타는 횟수만 많고, 돈은 몇 시간~며칠 들고 간 큰 포지션에서 남
        </p>
        <table className="mt-2 w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-gray-400 dark:border-gray-800">
              <th className={`${th} text-left`}>보유 시간</th>
              <th className={`${th} text-right`}>포지션</th>
              <th className={`${th} text-right`}>순손익</th>
              <th className={`${th} text-right`}>승률</th>
              <th className={`${th} text-right`}>크기 중간값</th>
            </tr>
          </thead>
          <tbody>
            {record.holdBuckets.map((row) => (
              <tr
                key={row.label}
                className="border-b border-gray-50 last:border-0 dark:border-gray-800"
              >
                <td className={`${td} font-semibold text-gray-900 dark:text-gray-100`}>
                  {row.label}
                </td>
                <td className={`${td} text-right text-gray-700 dark:text-gray-300`}>
                  {row.count.toLocaleString()}
                </td>
                <td className={`${td} text-right font-bold ${pnlColor(row.pnl)}`}>
                  {signedBtc(row.pnl)}
                </td>
                <td className={`${td} text-right text-gray-700 dark:text-gray-300`}>
                  {row.winRate}%
                </td>
                <td className={`${td} text-right text-gray-700 dark:text-gray-300`}>
                  {formatBtc(row.medianBtc)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TradeTable title="가장 크게 번 포지션" trades={record.bestTrades} />
        <TradeTable title="가장 크게 잃은 포지션" trades={record.worstTrades} />
      </div>
    </section>
  );
}

function TradeTable({ title, trades }: { title: string; trades: typeof record.bestTrades }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <p className="px-4 pt-4 text-sm font-bold text-gray-900 dark:text-gray-100">{title}</p>
      <table className="mt-2 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-gray-400 dark:border-gray-800">
            <th className={`${th} text-left`}>진입일</th>
            <th className={`${th} text-left`}>방향</th>
            <th className={`${th} text-right`}>최대 크기</th>
            <th className={`${th} text-right`}>보유</th>
            <th className={`${th} text-right`}>손익</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr
              key={trade.date + trade.pnl}
              className="border-b border-gray-50 last:border-0 dark:border-gray-800"
            >
              <td className={`${td} text-gray-500 dark:text-gray-400`}>{trade.date}</td>
              <td
                className={`${td} font-bold ${trade.direction === "롱" ? "text-red-500" : "text-blue-500"}`}
              >
                {trade.direction}
              </td>
              <td className={`${td} text-right text-gray-700 dark:text-gray-300`}>
                {formatBtc(trade.maxBtc, 0)}
              </td>
              <td className={`${td} text-right text-gray-700 dark:text-gray-300`}>
                {trade.hours}시간
              </td>
              <td className={`${td} text-right font-bold ${pnlColor(trade.pnl)}`}>
                {signedBtc(trade.pnl)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
