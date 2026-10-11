// 주식형 AI 장부. 모든 매매는 그날 종가로 체결한다.
import { DEPOSIT_DAY, DEPOSIT_KRW, STOCK_FEE } from "./config.ts";
import type { AiId } from "./config.ts";
import { addDays } from "./market.ts";
import type { Market } from "./market.ts";

export interface TradeRow {
  ai: AiId;
  traded_at: string;
  symbol: string;
  side: "buy" | "sell" | "short" | "cover";
  quantity: number; // 항상 양수, 방향은 side
  price: number; // 그 종목의 거래 통화 (한국 ETF는 원)
  leverage: number | null;
  reason: string;
}

export interface HoldingRow {
  ai: AiId;
  symbol: string;
  quantity: number; // 숏은 음수
  avg_price: number;
  leverage: number | null;
  opened_at: string;
  value: number; // USD
}

export interface EquityRow {
  ai: AiId;
  date: string;
  cash: number;
  equity: number;
  invested: number;
  withdrawn?: number; // 누적 출금 (USD). 출금하는 AI(워뇨띠)만 넣고, 나머지는 DB 기본값 0
}

interface Holding {
  quantity: number;
  avgPrice: number;
  openedAt: string;
}

export class Ledger {
  cash = 0; // currency 단위
  invested = 0; // USD 누적 입금
  holdings = new Map<string, Holding>();
  trades: TradeRow[] = [];
  equity: EquityRow[] = [];

  readonly ai: AiId;
  private market: Market;
  private currency: "USD" | "KRW";

  // 한국 ETF만 사는 AI는 원화로 장부를 쓰고, 기록할 때 그날 환율로 달러로 바꾼다.
  constructor(ai: AiId, market: Market, currency: "USD" | "KRW" = "USD") {
    this.ai = ai;
    this.market = market;
    this.currency = currency;
  }

  private toUsd(amount: number, day: string) {
    return this.currency === "KRW" ? amount / this.market.price("KRW=X", day)! : amount;
  }

  private priceOf(symbol: string, day: string) {
    const price = this.market.price(symbol, day);
    if (price === null) throw new Error(`${symbol} ${day} 가격 없음`);
    return price;
  }

  quantity(symbol: string) {
    return this.holdings.get(symbol)?.quantity ?? 0;
  }

  value(day: string) {
    let total = this.cash;
    for (const [symbol, holding] of this.holdings)
      total += holding.quantity * this.priceOf(symbol, day);
    return total;
  }

  deposit(day: string) {
    const krwPerUsd = this.market.price("KRW=X", day)!;
    this.cash += this.currency === "KRW" ? DEPOSIT_KRW : DEPOSIT_KRW / krwPerUsd;
    this.invested += DEPOSIT_KRW / krwPerUsd;
  }

  // quantity > 0 사기, < 0 팔기. 롱에서 숏으로 바로 넘어가는 주문은 청산 + 새 진입 두 건으로 나눈다.
  trade(symbol: string, quantity: number, day: string, reason: string) {
    const held = this.quantity(symbol);
    if (held !== 0 && Math.sign(held + quantity) === -Math.sign(held)) {
      this.trade(symbol, -held, day, reason);
      this.trade(symbol, held + quantity, day, reason);
      return;
    }
    const price = this.priceOf(symbol, day);
    this.cash -= quantity * price + Math.abs(quantity * price) * STOCK_FEE;

    const after = held + quantity;
    if (Math.abs(after) < 1e-9) {
      this.holdings.delete(symbol);
    } else if (held === 0) {
      this.holdings.set(symbol, { quantity: after, avgPrice: price, openedAt: day });
    } else {
      const holding = this.holdings.get(symbol)!;
      // 같은 방향으로 늘릴 때만 평균단가가 바뀐다.
      if (Math.abs(after) > Math.abs(held)) {
        holding.avgPrice = (holding.avgPrice * held + price * quantity) / after;
      }
      holding.quantity = after;
    }

    const side = quantity > 0 ? (held < 0 ? "cover" : "buy") : held > 0 ? "sell" : "short";
    this.trades.push({
      ai: this.ai,
      traded_at: day,
      symbol,
      side,
      quantity: Math.abs(quantity),
      price,
      leverage: null,
      reason,
    });
  }

  // 매 거래일 시작에 부른다: 현금 이자, 대차수수료, 배당, 상장폐지 정리. 받은 배당을 종목별로 돌려준다.
  startDay(day: string, previousDay: string) {
    const received = new Map<string, number>();
    for (const [symbol, holding] of [...this.holdings]) {
      // 인수 등으로 거래가 끝나면 마지막 가격에 현금화한다.
      if (this.market.lastDate(symbol)! < addDays(day, -7)) {
        this.trade(symbol, -holding.quantity, day, "상장폐지 정리");
        continue;
      }
      const dividend = this.market.dividend(symbol, day);
      if (dividend > 0) {
        // 숏이면 음수 = 빌린 주식의 배당을 대신 낸다.
        this.cash += holding.quantity * dividend;
        received.set(symbol, holding.quantity * dividend);
      }
    }

    if (this.currency === "USD") {
      const days = (Date.parse(day) - Date.parse(previousDay)) / 86_400_000;
      let shortValue = 0;
      for (const [symbol, holding] of this.holdings) {
        if (holding.quantity < 0) shortValue -= holding.quantity * this.priceOf(symbol, day);
      }
      // 공매도 대금은 이자를 받지 않는 담보로 보고, 그걸 뺀 현금만 단기국채 금리를 받는다.
      const rate = this.market.price("^IRX", previousDay)! / 100;
      this.cash += Math.max(0, this.cash - shortValue) * rate * (days / 365);
      this.cash -= shortValue * 0.005 * (days / 365); // 대차수수료 연 0.5% 가정
    }
    return received;
  }

  record(day: string) {
    this.equity.push({
      ai: this.ai,
      date: day,
      cash: this.toUsd(this.cash, day),
      equity: this.toUsd(this.value(day), day),
      invested: this.invested,
    });
  }

  holdingRows(day: string): HoldingRow[] {
    return [...this.holdings].map(([symbol, holding]) => ({
      ai: this.ai,
      symbol,
      quantity: holding.quantity,
      avg_price: holding.avgPrice,
      leverage: null,
      opened_at: holding.openedAt,
      value: this.toUsd(holding.quantity * this.priceOf(symbol, day), day),
    }));
  }
}

// 매월 DEPOSIT_DAY일 입금. 휴장이면 다음 거래일.
export function depositDays(tradingDays: string[]) {
  const result = new Set<string>();
  const first = tradingDays[0];
  const last = tradingDays.at(-1)!;
  for (
    let month = new Date(first.slice(0, 7) + "-01");
    ;
    month.setUTCMonth(month.getUTCMonth() + 1)
  ) {
    const target = `${month.toISOString().slice(0, 7)}-${String(DEPOSIT_DAY).padStart(2, "0")}`;
    if (target > last) break;
    const day = tradingDays.find((d) => d >= target);
    if (day) result.add(day);
  }
  return result;
}
