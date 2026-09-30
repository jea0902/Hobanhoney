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

// "rows" 배열 + nextPageCursor 형태로 페이지네이션하는 엔드포인트(입출금 내역 등) 공용 헬퍼.
async function signedGetAllRows<T>(path: string, baseParams: Record<string, string>): Promise<T[]> {
  const rows: T[] = [];
  let cursor = "";
  for (let i = 0; i < 20; i++) {
    const params = cursor ? { ...baseParams, cursor } : baseParams;
    const json = await signedGet(path, params);
    if (json?.retCode !== 0) break;
    const page = (json?.result?.rows ?? []) as T[];
    rows.push(...page);
    cursor = json?.result?.nextPageCursor ?? "";
    if (!cursor || page.length === 0) break;
  }
  return rows;
}

export interface OwnerBalance {
  totalEquity: number;
  totalWalletBalance: number;
  totalUnrealizedPnl: number;
}

// 캐시 없이 매번 조회한다. unstable_cache(10초)를 썼더니 기간이 지난 뒤 첫 요청엔 마지막 방문 시점의
// 오래된 값을 돌려줘서 새로고침을 한두 번 해야 최신이 보였다. 트래픽이 늘면 TODO 7번에서 다시 설계.
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
  openedAt: string;
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
  openTime: number;
}

// USDT 무기한 선물(linear)만 다룬다 — 주인장 계정이 실제로 쓰는 카테고리.
// getOwnerBalance와 같은 이유로 캐시 없이 매번 조회한다.
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
        openedAt: new Date(position.openTime).toISOString(),
      };
    });
  } catch (error) {
    logEvent("error", "bybit_private", "주인장 포지션 조회 중 예외 발생", String(error));
    return null;
  }
}

export interface CashFlowRecord {
  txId: string;
  type: "deposit" | "withdraw";
  coin: string;
  amount: number;
  occurredAt: string;
}

interface RawDepositRecord {
  coin: string;
  amount: string;
  txID: string;
  successAt: string;
  status: number;
}

// startTime~endTime은 최대 30일 구간만 허용됨(Bybit 제약).
export async function getDeposits(
  startTime: number,
  endTime: number,
): Promise<CashFlowRecord[] | null> {
  try {
    const rows = await signedGetAllRows<RawDepositRecord>("/v5/asset/deposit/query-record", {
      startTime: String(startTime),
      endTime: String(endTime),
      limit: "50",
    });
    return rows
      .filter((row) => row.status === 3) // 3 = 입금 성공
      .map((row) => ({
        txId: row.txID,
        type: "deposit" as const,
        coin: row.coin,
        amount: Number(row.amount),
        occurredAt: new Date(Number(row.successAt)).toISOString(),
      }));
  } catch (error) {
    logEvent("error", "bybit_private", "입금 내역 조회 중 예외 발생", String(error));
    return null;
  }
}

interface RawWithdrawRecord {
  coin: string;
  amount: string;
  txID: string;
  updateTime: string;
  status: string;
}

// startTime~endTime은 최대 30일 구간만 허용됨(Bybit 제약).
export async function getWithdrawals(
  startTime: number,
  endTime: number,
): Promise<CashFlowRecord[] | null> {
  try {
    const rows = await signedGetAllRows<RawWithdrawRecord>("/v5/asset/withdraw/query-record", {
      startTime: String(startTime),
      endTime: String(endTime),
      limit: "50",
    });
    return rows
      .filter((row) => row.status === "success")
      .map((row) => ({
        txId: row.txID,
        type: "withdraw" as const,
        coin: row.coin,
        amount: Number(row.amount),
        occurredAt: new Date(Number(row.updateTime)).toISOString(),
      }));
  } catch (error) {
    logEvent("error", "bybit_private", "출금 내역 조회 중 예외 발생", String(error));
    return null;
  }
}

export interface ClosedTradeRecord {
  orderId: string;
  symbol: string;
  closedPnl: number;
  direction: Direction;
  avgEntryPrice: number;
  closedAt: string;
}

interface RawClosedPnl {
  orderId: string;
  symbol: string;
  closedPnl: string;
  // side는 "원래 포지션 방향"이 아니라 "청산 주문 방향"이다 (Buy로 청산 = 원래 Short였던 포지션).
  // 실제 데이터로 검증: side=Sell, 청산가>진입가인데 손익이 플러스였음 → 그 경우는 롱이어야 맞는 계산.
  side: "Buy" | "Sell";
  avgEntryPrice: string;
  updatedTime: string;
}

// startTime~endTime은 최대 7일 구간만 허용됨(Bybit 제약). USDT 무기한 선물만 다룬다.
export async function getClosedPnl(
  startTime: number,
  endTime: number,
): Promise<ClosedTradeRecord[] | null> {
  try {
    const rows: RawClosedPnl[] = [];
    let cursor = "";
    for (let i = 0; i < 20; i++) {
      const params: Record<string, string> = {
        category: "linear",
        startTime: String(startTime),
        endTime: String(endTime),
        limit: "100",
      };
      if (cursor) params.cursor = cursor;
      const json = await signedGet("/v5/position/closed-pnl", params);
      if (json?.retCode !== 0) break;
      const page = (json?.result?.list ?? []) as RawClosedPnl[];
      rows.push(...page);
      cursor = json?.result?.nextPageCursor ?? "";
      if (!cursor || page.length === 0) break;
    }
    return rows.map((row) => ({
      orderId: row.orderId,
      symbol: row.symbol,
      closedPnl: Number(row.closedPnl),
      direction: row.side === "Buy" ? ("Short" as Direction) : ("Long" as Direction),
      avgEntryPrice: Number(row.avgEntryPrice),
      closedAt: new Date(Number(row.updatedTime)).toISOString(),
    }));
  } catch (error) {
    logEvent("error", "bybit_private", "청산 거래 내역 조회 중 예외 발생", String(error));
    return null;
  }
}
