import { createHmac } from "crypto";
import { logEvent } from "@/lib/logger";
import type { Direction } from "@/types/position";

// 주인장 개인 계정 전용 (읽기 전용 API 키). 다른 트레이더 추적에 쓰는 bybit.ts의 공개 시세 API와는 별개.
const BASE_URL = "https://api.bybit.com";
const RECV_WINDOW = "5000";

function sign(timestamp: string, queryString: string) {
  const payload = timestamp + process.env.BYBIT_API_KEY + RECV_WINDOW + queryString;
  return createHmac("sha256", process.env.BYBIT_API_SECRET!).update(payload).digest("hex");
}

async function signedGet(path: string, params: Record<string, string>) {
  const timestamp = Date.now().toString();
  const queryString = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE_URL}${path}?${queryString}`, {
    headers: {
      "X-BAPI-API-KEY": process.env.BYBIT_API_KEY!,
      "X-BAPI-SIGN": sign(timestamp, queryString),
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-RECV-WINDOW": RECV_WINDOW,
    },
    cache: "no-store",
  });
  return res.json();
}

export interface OwnerBalance {
  totalEquity: number;
  totalWalletBalance: number;
  totalUnrealizedPnl: number;
}

export async function getOwnerBalance(): Promise<OwnerBalance | null> {
  try {
    const json = await signedGet("/v5/account/wallet-balance", { accountType: "UNIFIED" });
    const account = json?.result?.list?.[0];
    if (json?.retCode !== 0 || !account) {
      logEvent(
        "error",
        "bybit_private",
        "주인장 잔액 조회 실패",
        JSON.stringify(json).slice(0, 300),
      );
      return null;
    }
    return {
      totalEquity: Number(account.totalEquity),
      totalWalletBalance: Number(account.totalWalletBalance),
      totalUnrealizedPnl: Number(account.totalPerpUPL),
    };
  } catch (error) {
    logEvent("error", "bybit_private", "주인장 잔액 조회 중 예외 발생", String(error));
    return null;
  }
}

export interface OwnerPosition {
  symbol: string;
  direction: Direction;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  liquidationPrice: number | null;
  positionValue: number;
  unrealizedPnl: number;
  returnOnEquityPercent: number;
}

interface RawOwnerPosition {
  symbol: string;
  side: "Buy" | "Sell";
  size: string;
  avgPrice: string;
  markPrice: string;
  leverage: string;
  liqPrice: string;
  positionValue: string;
  positionIM: string;
  unrealisedPnl: string;
}

// USDT 무기한 선물(linear)만 다룬다 — 주인장 계정이 실제로 쓰는 카테고리.
export async function getOwnerPositions(): Promise<OwnerPosition[] | null> {
  try {
    const json = await signedGet("/v5/position/list", {
      category: "linear",
      settleCoin: "USDT",
    });
    const list = json?.result?.list as RawOwnerPosition[] | undefined;
    if (json?.retCode !== 0 || !Array.isArray(list)) {
      logEvent(
        "error",
        "bybit_private",
        "주인장 포지션 조회 실패",
        JSON.stringify(json).slice(0, 300),
      );
      return null;
    }

    return list.map((position) => {
      const positionIM = Number(position.positionIM || 0);
      const unrealizedPnl = Number(position.unrealisedPnl);
      return {
        symbol: position.symbol,
        direction: position.side === "Buy" ? "Long" : ("Short" as Direction),
        quantity: Number(position.size),
        entryPrice: Number(position.avgPrice),
        currentPrice: Number(position.markPrice),
        leverage: Number(position.leverage),
        liquidationPrice: position.liqPrice ? Number(position.liqPrice) : null,
        positionValue: Number(position.positionValue),
        unrealizedPnl,
        returnOnEquityPercent: positionIM > 0 ? (unrealizedPnl / positionIM) * 100 : 0,
      };
    });
  } catch (error) {
    logEvent("error", "bybit_private", "주인장 포지션 조회 중 예외 발생", String(error));
    return null;
  }
}
