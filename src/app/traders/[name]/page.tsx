import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import { getSupabase } from "@/lib/supabase";
import { getTraderStats } from "@/lib/traderGroups";
import type { PositionRow, Direction } from "@/types/position";

export const dynamic = "force-dynamic";

const RESULT_LABEL = { win: "승", draw: "무", loss: "패" } as const;

async function getTraderRows(name: string): Promise<PositionRow[]> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("positions")
    .select("*")
    .eq("trader_name", name)
    .order("created_at", { ascending: false });
  return (data ?? []) as PositionRow[];
}

function formatKstDate(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function directionStats(rows: PositionRow[], direction: Direction) {
  const decided = rows.filter((row) => row.direction === direction && row.result);
  const wins = decided.filter((row) => row.result === "win").length;
  return {
    count: rows.filter((row) => row.direction === direction).length,
    decided: decided.length,
    winRate: decided.length > 0 ? (wins / decided.length) * 100 : null,
  };
}

function topSymbols(rows: PositionRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.symbol) counts.set(row.symbol, (counts.get(row.symbol) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
}

export async function generateMetadata({
  params,
}: {
  params: { name: string };
}): Promise<Metadata> {
  const name = decodeURIComponent(params.name);
  return {
    title: `${name} 포지션 기록과 승률 | 호반꿀`,
    description: `유튜버 트레이더 ${name}의 실제 포지션 기록, 누적 승률, 롱·숏 성향과 자주 거래한 종목을 정리했습니다.`,
  };
}

export default async function TraderPage({ params }: { params: { name: string } }) {
  const name = decodeURIComponent(params.name);
  const rows = await getTraderRows(name);
  if (rows.length === 0) notFound();

  const stats = getTraderStats(rows, name);
  const long = directionStats(rows, "Long");
  const short = directionStats(rows, "Short");
  const symbols = topSymbols(rows);
  const openRows = rows.filter((row) => !row.result);
  const decidedRows = rows.filter((row) => row.result);
  const pnlValues = decidedRows
    .filter((row) => row.result_pnl_percent !== null)
    .map((row) => Number(row.result_pnl_percent));
  const avgPnl =
    pnlValues.length > 0
      ? pnlValues.reduce((sum, value) => sum + value, 0) / pnlValues.length
      : null;
  const firstRecordedAt = rows[rows.length - 1].created_at;
  const image = rows.find((row) => row.trader_image)?.trader_image ?? null;
  const mainDirection = long.count >= short.count ? "롱" : "숏";

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-indigo-50/40 to-indigo-50 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900">
      <Navbar />

      <section className="px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-4">
            {image && (
              // eslint-disable-next-line @next/next/no-img-element -- 관리자가 임의 외부 URL을 입력하므로 next/image 도메인 화이트리스트 없이 처리
              <img src={image} alt={name} className="h-16 w-16 rounded-full object-cover" />
            )}
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
                {name} 포지션 기록
              </h1>
              <p className="mt-1 text-sm text-gray-400">
                {formatKstDate(firstRecordedAt)}부터 호반꿀이 추적 중인 유튜버 트레이더
              </p>
            </div>
          </div>

          {/* 트레이더마다 다른 요약 문장 — 숫자 표만 있는 페이지보다 읽을 거리를 준다 */}
          <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-5 text-[15px] leading-7 text-gray-700 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
            <p>
              {name}의 기록은 총 <strong>{rows.length}건</strong>입니다.
              {stats.total > 0 ? (
                <>
                  {" "}
                  결과가 나온 {stats.total}건 중 {stats.wins}승 {stats.draws}무 {stats.losses}패로
                  누적 승률은 <strong>{stats.winRate!.toFixed(0)}%</strong>입니다.
                </>
              ) : (
                " 아직 결과가 나온 포지션이 없습니다."
              )}{" "}
              방향은 롱 {long.count}건, 숏 {short.count}건으로{" "}
              {long.count === short.count
                ? "롱과 숏을 고르게 잡았습니다."
                : `${mainDirection} 비중이 더 높습니다.`}
              {symbols.length > 0 && (
                <>
                  {" "}
                  가장 많이 거래한 종목은{" "}
                  {symbols.map(([symbol, count]) => `${symbol}(${count}건)`).join(", ")}
                  입니다.
                </>
              )}
            </p>
            {stats.total > 0 && stats.total < 10 && (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                결과가 나온 기록이 아직 10건 미만이라 승률이 우연에 크게 흔들릴 수 있습니다.
              </p>
            )}
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              승패는 종료 시점 수익률 +3% 이상이면 승, -3% 이하이면 패, 그 사이면 무승부로 매깁니다.
              승률 읽는 법은{" "}
              <Link
                href="/guides/human-indicator"
                className="text-indigo-600 underline dark:text-indigo-400"
              >
                인간지표 가이드
              </Link>
              를 참고하세요.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="누적 승률"
              value={stats.winRate === null ? "—" : `${stats.winRate.toFixed(0)}%`}
              sub={`${stats.wins}승 ${stats.draws}무 ${stats.losses}패`}
            />
            <StatCard
              label="롱 승률"
              value={long.winRate === null ? "—" : `${long.winRate.toFixed(0)}%`}
              sub={`롱 ${long.count}건`}
            />
            <StatCard
              label="숏 승률"
              value={short.winRate === null ? "—" : `${short.winRate.toFixed(0)}%`}
              sub={`숏 ${short.count}건`}
            />
            <StatCard
              label="평균 결과 수익률"
              value={avgPnl === null ? "—" : `${avgPnl > 0 ? "+" : ""}${avgPnl.toFixed(1)}%`}
              sub={`수익률 기록 ${pnlValues.length}건 기준`}
            />
          </div>

          {openRows.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                진행 중인 포지션
              </h2>
              <p className="mt-1 text-xs text-gray-400">
                실시간 수익률은{" "}
                <Link href="/" className="underline">
                  홈
                </Link>
                에서 볼 수 있어요.
              </p>
              <HistoryTable rows={openRows} />
            </div>
          )}

          <div className="mt-8">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              종료된 포지션 기록
            </h2>
            <p className="mt-1 text-xs text-gray-400">
              최신순 · 시각은 한국시간 기준 포지션 기록 시점
            </p>
            {decidedRows.length > 0 ? (
              <HistoryTable rows={decidedRows} />
            ) : (
              <p className="mt-3 rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-900">
                아직 종료된 포지션이 없어요.
              </p>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-2 text-xl font-extrabold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{sub}</p>
    </div>
  );
}

function HistoryTable({ rows }: { rows: PositionRow[] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-gray-400 dark:border-gray-800 dark:text-gray-500">
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium">기록 시각</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium">종목</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium">방향</th>
            <th className="whitespace-nowrap px-4 py-3 text-right font-medium">레버리지</th>
            <th className="whitespace-nowrap px-4 py-3 text-right font-medium">진입가</th>
            <th className="whitespace-nowrap px-4 py-3 text-right font-medium">결과</th>
            <th className="whitespace-nowrap px-4 py-3 text-right font-medium">결과 수익률</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-gray-50 text-gray-700 last:border-0 dark:border-gray-800/60 dark:text-gray-300"
            >
              <td className="whitespace-nowrap px-4 py-3">{formatKstDate(row.created_at)}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.symbol ?? "예측 발언"}</td>
              <td
                className={`whitespace-nowrap px-4 py-3 font-bold ${row.direction === "Long" ? "text-red-500" : "text-blue-500"}`}
              >
                {row.direction}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
                {row.leverage ? `${row.leverage}x` : "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
                {row.entry_price?.toLocaleString("en-US") ?? "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-bold">
                {row.result ? RESULT_LABEL[row.result] : "진행 중"}
              </td>
              <td
                className={`whitespace-nowrap px-4 py-3 text-right ${
                  row.result_pnl_percent === null
                    ? "text-gray-300 dark:text-gray-600"
                    : row.result_pnl_percent >= 0
                      ? "text-red-500"
                      : "text-blue-500"
                }`}
              >
                {row.result_pnl_percent === null
                  ? "—"
                  : `${row.result_pnl_percent > 0 ? "+" : ""}${Number(row.result_pnl_percent).toFixed(1)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
