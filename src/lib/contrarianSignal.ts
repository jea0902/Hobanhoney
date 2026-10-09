import { getCryptoFearGreed } from "@/lib/alternativeMe";
import { getDailyCloses, getFundingRate, getLongShortRatio } from "@/lib/bybit";

// 역발상 신호등 기준값. "개인들이 겁먹고 던질 때"만 켜지도록 보수적으로 잡았다. 숫자만 바꾸면 된다.
export const CONTRARIAN_RULES = {
  fearGreedMax: 20, // 공포탐욕지수 이하 (극도의 공포)
  shortRatioMin: 0.5, // Bybit 계정 숏 비율 이상 (평소엔 롱이 60~70%라 숏이 절반만 넘어도 드묾)
  fundingRateMax: 0, // 펀딩비 미만 (마이너스 = 숏이 롱에게 돈을 내는 중)
  rsiMax: 30, // 일봉 RSI(14) 이하 (과매도)
  greenMin: 4, // 5개 중 이 개수 이상 켜져야 초록불
} as const;

const SYMBOL = "BTCUSDT";

export interface SignalCondition {
  label: string;
  current: string;
  // null = 데이터를 못 받아서 판단 불가 (켜진 것으로 세지 않음)
  met: boolean | null;
}

// 와일더 방식 RSI. closes는 오래된 것부터.
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

// 유튜버 수는 홈의 인간지표 컨센서스 게이지와 같은 숫자를 받는다.
export async function getBtcContrarianConditions(
  youtuberLongCount: number,
  youtuberShortCount: number,
): Promise<SignalCondition[]> {
  const [fearGreed, ratio, fundingRate, closes] = await Promise.all([
    getCryptoFearGreed(),
    getLongShortRatio(SYMBOL),
    getFundingRate(SYMBOL),
    // RSI는 앞부분 평균이 수렴하려면 기간보다 넉넉한 캔들이 필요하다.
    getDailyCloses(SYMBOL, 200),
  ]);
  const rsi = closes ? getRsi(closes) : null;
  const youtuberTotal = youtuberLongCount + youtuberShortCount;

  return [
    {
      label: `공포탐욕지수 ${CONTRARIAN_RULES.fearGreedMax} 이하`,
      current: fearGreed ? `${fearGreed.value} (${fearGreed.classification})` : "데이터 없음",
      met: fearGreed ? fearGreed.value <= CONTRARIAN_RULES.fearGreedMax : null,
    },
    {
      label: `개인 계좌 숏 ${CONTRARIAN_RULES.shortRatioMin * 100}% 이상`,
      current: ratio
        ? `숏 ${(ratio.shortRatio * 100).toFixed(0)}% · 롱 ${(ratio.longRatio * 100).toFixed(0)}%`
        : "데이터 없음",
      met: ratio ? ratio.shortRatio >= CONTRARIAN_RULES.shortRatioMin : null,
    },
    {
      label: "펀딩비 마이너스",
      current: fundingRate === null ? "데이터 없음" : `${(fundingRate * 100).toFixed(4)}%`,
      met: fundingRate === null ? null : fundingRate < CONTRARIAN_RULES.fundingRateMax,
    },
    {
      label: `일봉 RSI ${CONTRARIAN_RULES.rsiMax} 이하`,
      current: rsi === null ? "데이터 없음" : rsi.toFixed(0),
      met: rsi === null ? null : rsi <= CONTRARIAN_RULES.rsiMax,
    },
    {
      // 인간지표는 반대로: 유튜버 다수가 숏이면 롱 쪽 신호.
      label: "인간지표 유튜버 다수 숏",
      current:
        youtuberTotal === 0
          ? "열린 포지션 없음"
          : `롱 ${youtuberLongCount}명 · 숏 ${youtuberShortCount}명`,
      met: youtuberTotal === 0 ? null : youtuberShortCount > youtuberLongCount,
    },
  ];
}
