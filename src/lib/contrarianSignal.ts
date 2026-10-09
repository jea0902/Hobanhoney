import { getSupabase } from "@/lib/supabase";
import { getCryptoFearGreed } from "@/lib/alternativeMe";
import { getDailyCloses, getLongShortRatio } from "@/lib/bybit";
import { countDirections, getTraderGroups, withRepresentativePosition } from "@/lib/traderGroups";
import type { PositionRow } from "@/types/position";

// 역발상 신호등 기준값. 숫자만 바꾸면 된다. (2026-10-09 백테스트 근거는 TODO.md 15번)
export const SIGNAL_RULES = {
  bottom: {
    fearGreedMax: 15, // 2018~2026 전체 기간 중 7.7%의 날만 해당
    rsiMax: 20,
    // Bybit 계정 수 기준. 개인들은 폭락 때 물타기로 롱을 늘려서(최대 80%) 공포 구간에 롱 쏠림이 나타난다.
    accountLongMin: 0.7,
  },
  top: {
    fearGreedMin: 85, // 전체 기간 중 3.0%. 2019-06, 2020-12~2021-02, 2024-03·11 강세장 꼭대기에서만
    rsiMin: 80,
    // 상승장에서 개인들이 꼭대기를 잡겠다고 숏을 늘린다. 평소 계정 숏은 30~40%대.
    accountShortMin: 0.5,
  },
  greenMin: 3, // 4개 중 이 개수 이상 켜지면 초록불
  yellowMin: 2,
} as const;

const SYMBOL = "BTCUSDT";

export interface SignalCondition {
  label: string;
  current: string;
  // null = 데이터를 못 받아서 판단 불가 (켜진 것으로 세지 않음)
  met: boolean | null;
}

export interface ContrarianSignals {
  bottom: SignalCondition[];
  top: SignalCondition[];
  accountRatio: { longRatio: number; shortRatio: number } | null;
}

// 와일더 방식 RSI(14). closes는 오래된 것부터.
function getRsi(closes: number[], period = 14): number | null {
  if (closes.length <= period) return null;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    avgGain += Math.max(change, 0) / period;
    avgLoss += Math.max(-change, 0) / period;
  }
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

// 홈 포지션 표의 인간지표 컨센서스와 같은 기준(트레이더별 대표 포지션 1인 1표)으로 센다.
async function getYoutuberCounts() {
  const { data } = await getSupabase().from("positions").select("*");
  const traders = await withRepresentativePosition(getTraderGroups((data ?? []) as PositionRow[]));
  return countDirections(traders);
}

const percent = (ratio: number) => `${(ratio * 100).toFixed(0)}%`;

export async function getContrarianSignals(): Promise<ContrarianSignals> {
  const [fearGreed, accountRatio, closes, youtubers] = await Promise.all([
    getCryptoFearGreed(),
    getLongShortRatio(SYMBOL),
    // RSI는 앞부분 평균이 수렴하려면 기간보다 넉넉한 캔들이 필요하다.
    getDailyCloses(SYMBOL, 200),
    getYoutuberCounts(),
  ]);
  const rsi = closes ? getRsi(closes) : null;
  const { bottom, top } = SIGNAL_RULES;

  const fearGreedText = fearGreed
    ? `${fearGreed.value} (${fearGreed.classification})`
    : "데이터 없음";
  const rsiText = rsi === null ? "데이터 없음" : rsi.toFixed(0);
  const youtuberTotal = youtubers.longCount + youtubers.shortCount;
  const youtuberText =
    youtuberTotal === 0
      ? "열린 포지션 없음"
      : `롱 ${youtubers.longCount} · 숏 ${youtubers.shortCount}`;

  return {
    accountRatio,
    bottom: [
      {
        label: `공포탐욕 ${bottom.fearGreedMax} 이하`,
        current: fearGreedText,
        met: fearGreed ? fearGreed.value <= bottom.fearGreedMax : null,
      },
      {
        label: `일봉 RSI ${bottom.rsiMax} 이하`,
        current: rsiText,
        met: rsi === null ? null : rsi <= bottom.rsiMax,
      },
      {
        label: `개인 롱 쏠림 ${percent(bottom.accountLongMin)} 이상`,
        current: accountRatio ? `롱 ${percent(accountRatio.longRatio)}` : "데이터 없음",
        met: accountRatio ? accountRatio.longRatio >= bottom.accountLongMin : null,
      },
      {
        // 인간지표는 반대로: 유튜버 다수가 숏이면 저점 쪽 신호.
        label: "인간지표 다수 숏",
        current: youtuberText,
        met: youtuberTotal === 0 ? null : youtubers.shortCount > youtubers.longCount,
      },
    ],
    top: [
      {
        label: `공포탐욕 ${top.fearGreedMin} 이상`,
        current: fearGreedText,
        met: fearGreed ? fearGreed.value >= top.fearGreedMin : null,
      },
      {
        label: `일봉 RSI ${top.rsiMin} 이상`,
        current: rsiText,
        met: rsi === null ? null : rsi >= top.rsiMin,
      },
      {
        label: `개인 숏 쏠림 ${percent(top.accountShortMin)} 이상`,
        current: accountRatio ? `숏 ${percent(accountRatio.shortRatio)}` : "데이터 없음",
        met: accountRatio ? accountRatio.shortRatio >= top.accountShortMin : null,
      },
      {
        label: "인간지표 다수 롱",
        current: youtuberText,
        met: youtuberTotal === 0 ? null : youtubers.longCount > youtubers.shortCount,
      },
    ],
  };
}
