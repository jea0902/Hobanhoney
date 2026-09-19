import { logEvent } from "@/lib/logger";
import type { Direction } from "@/types/position";

export interface HyperliquidPosition {
  coin: string;
  direction: Direction;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  positionValue: number;
  unrealizedPnl: number;
  returnOnEquityPercent: number;
}

interface RawHyperliquidPosition {
  coin: string;
  szi: string;
  leverage: { type: string; value: number };
  entryPx: string;
  positionValue: string;
  unrealizedPnl: string;
  returnOnEquity: string;
}

// 하이퍼리퀴드 공개 Info API. 지갑 주소만 있으면 인증 없이 그 계정의 현재 포지션을 조회할 수 있다.
export async function getHyperliquidPositions(
  address: string,
): Promise<HyperliquidPosition[] | null> {
  try {
    const res = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "clearinghouseState", user: address }),
      next: { revalidate: 10 },
    });
    const json = await res.json();
    const assetPositions = json?.assetPositions;
    if (!Array.isArray(assetPositions)) {
      logEvent("error", "hyperliquid", "포지션 조회 실패", `address=${address}`);
      return null;
    }

    return assetPositions.map(({ position }: { position: RawHyperliquidPosition }) => {
      const szi = Number(position.szi);
      const positionValue = Number(position.positionValue);
      return {
        coin: position.coin,
        direction: szi >= 0 ? "Long" : "Short",
        quantity: Math.abs(szi),
        entryPrice: Number(position.entryPx),
        currentPrice: positionValue / Math.abs(szi),
        leverage: Number(position.leverage?.value ?? 0),
        positionValue,
        unrealizedPnl: Number(position.unrealizedPnl),
        returnOnEquityPercent: Number(position.returnOnEquity) * 100,
      };
    });
  } catch (error) {
    logEvent(
      "error",
      "hyperliquid",
      "포지션 조회 중 예외 발생",
      `address=${address} ${String(error)}`,
    );
    return null;
  }
}
