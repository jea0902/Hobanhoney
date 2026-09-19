import { logEvent } from "@/lib/logger";

export interface CryptoFearGreed {
  value: number;
  classification: string;
  changeFromYesterday: number;
}

const CLASSIFICATION_KO: Record<string, string> = {
  "Extreme Fear": "극단적 공포",
  Fear: "공포",
  Neutral: "중립",
  Greed: "탐욕",
  "Extreme Greed": "극단적 탐욕",
};

export async function getCryptoFearGreed(): Promise<CryptoFearGreed | null> {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=2", {
      next: { revalidate: 60 },
    });
    const json = await res.json();
    const [today, yesterday] = json?.data ?? [];
    if (!today) {
      logEvent("error", "alternative_me", "공포탐욕지수 조회 실패", "no data");
      return null;
    }

    const value = Number(today.value);
    const prevValue = yesterday ? Number(yesterday.value) : value;

    return {
      value,
      classification: CLASSIFICATION_KO[today.value_classification] ?? today.value_classification,
      changeFromYesterday: value - prevValue,
    };
  } catch (error) {
    logEvent("error", "alternative_me", "공포탐욕지수 조회 중 예외 발생", String(error));
    return null;
  }
}
