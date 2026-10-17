// 지갑 추적 트레이더(제프리황 등)의 하이퍼리퀴드 체결 기록을 "진입 → 완전 종료" 포지션 1건씩으로 묶어 DB에 쌓는다.
// 실행: npm run wallet-traders (GitHub Actions ai-investors 워크플로가 매일 돌린다)
// 체결이 하루 1만 건 넘게 나와서, 마지막으로 처리한 시각과 아직 안 닫힌 포지션의 상태를 wallet_sync에 저장해두고 이어서 처리한다.
import { setTimeout as sleep } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import { getResult } from "../../src/lib/positionMath.ts";
import { WALLET_TRADERS } from "../../src/lib/walletTraderList.ts";

const INITIAL_TRADES = 50;

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface Fill {
  coin: string;
  px: string;
  sz: string;
  side: "B" | "A";
  time: number;
  startPosition: string;
  closedPnl: string;
  fee: string;
  tid: number;
}

// 아직 안 닫힌 포지션의 진행 상태
interface OpenState {
  direction: "Long" | "Short";
  openedAt: number;
  entryCost: number; // 진입 체결 가격 × 수량 합
  entrySize: number;
  maxSize: number;
  pnl: number; // 실현손익 합 (수수료 제외 전)
  fees: number;
}

async function hyperliquid(body: object) {
  // 하이퍼리퀴드는 연달아 부르면 429로 막아서 기다렸다 다시 보낸다.
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    if (res.status !== 429) throw new Error(`Hyperliquid ${res.status}: ${await res.text()}`);
    await sleep(10_000 * attempt);
  }
  throw new Error("Hyperliquid 429가 계속됨");
}

// startTime 이후 체결을 오래된 순으로 끝까지 받는다 (한 번에 최대 2,000건).
async function fetchFillsSince(address: string, startTime: number) {
  const fills: Fill[] = [];
  for (let start = startTime; ;) {
    const page = (await hyperliquid({
      type: "userFillsByTime",
      user: address,
      startTime: start,
    })) as Fill[];
    fills.push(...page);
    if (page.length < 2000) break;
    start = Math.max(...page.map((f) => f.time)) + 1;
    await sleep(2_000);
  }
  // 페이지 경계에서 같은 체결이 두 번 올 수 있어 체결 번호로 거른다.
  const unique = new Map(fills.map((f) => [f.tid, f]));
  return [...unique.values()].sort((a, b) => a.time - b.time || a.tid - b.tid);
}

const leverageCache = new Map<string, number>();
async function getLeverage(address: string, coin: string) {
  if (!leverageCache.has(coin)) {
    const data = await hyperliquid({ type: "activeAssetData", user: address, coin });
    leverageCache.set(coin, Number(data?.leverage?.value ?? 1));
    await sleep(500);
  }
  return leverageCache.get(coin)!;
}

function isZero(size: number, reference: number) {
  return Math.abs(size) <= Math.max(1e-12, Math.abs(reference) * 1e-9);
}

async function syncTrader(name: string, address: string) {
  const { data: sync } = await supabase
    .from("wallet_sync")
    .select("*")
    .eq("trader_name", name)
    .maybeSingle();
  const open: Record<string, OpenState> = sync?.open_positions ?? {};
  const fills = await fetchFillsSince(address, sync ? Number(sync.synced_until) + 1 : 0);
  console.log(`${name}: 새 체결 ${fills.length}건`);
  if (fills.length === 0) return;

  const closed: object[] = [];
  const finish = async (coin: string, state: OpenState, closedAt: number) => {
    const leverage = await getLeverage(address, coin);
    const entryPrice = state.entryCost / state.entrySize;
    const pnl = state.pnl - state.fees;
    const margin = (state.maxSize * entryPrice) / leverage;
    const percent = margin > 0 ? (pnl / margin) * 100 : 0;
    closed.push({
      trader_name: name,
      coin,
      direction: state.direction,
      entry_price: entryPrice,
      max_size: state.maxSize,
      leverage,
      pnl,
      result_pnl_percent: percent,
      result: getResult(percent),
      opened_at: new Date(state.openedAt).toISOString(),
      closed_at: new Date(closedAt).toISOString(),
    });
  };
  const start = (fill: Fill, size: number): OpenState => ({
    direction: size > 0 ? "Long" : "Short",
    openedAt: fill.time,
    entryCost: Number(fill.px) * Math.abs(size),
    entrySize: Math.abs(size),
    maxSize: Math.abs(size),
    pnl: 0,
    fees: 0,
  });

  for (const fill of fills) {
    const size = Number(fill.sz) * (fill.side === "B" ? 1 : -1);
    const before = Number(fill.startPosition);
    const after = before + size;
    const state = open[fill.coin];

    if (!state) {
      // 처음 받은 기록 중간부터 이어지는 포지션은 진입을 모르니 건너뛰고, 0에서 시작하는 것부터 센다.
      if (isZero(before, after)) {
        open[fill.coin] = { ...start(fill, after), fees: Number(fill.fee) };
      } else if (!isZero(after, before) && before > 0 !== after > 0) {
        open[fill.coin] = start(fill, after); // 방향을 뒤집으며 새로 연 부분
      }
      continue;
    }

    state.fees += Number(fill.fee);
    state.pnl += Number(fill.closedPnl);
    if (isZero(after, before)) {
      await finish(fill.coin, state, fill.time);
      delete open[fill.coin];
    } else if (before > 0 !== after > 0) {
      await finish(fill.coin, state, fill.time);
      open[fill.coin] = start(fill, after);
    } else if (Math.abs(after) > Math.abs(before)) {
      state.entryCost += Number(fill.px) * Math.abs(size);
      state.entrySize += Math.abs(size);
      state.maxSize = Math.max(state.maxSize, Math.abs(after));
    }
  }

  // 처음 수집할 땐 받을 수 있는 기록 중 최근 완료 포지션 50건만 넣고(사용자 결정 2026-10-17), 이후로는 전부 쌓는다.
  const toSave = sync ? closed : closed.slice(-INITIAL_TRADES);
  for (let i = 0; i < toSave.length; i += 500) {
    const { error } = await supabase.from("wallet_trades").upsert(toSave.slice(i, i + 500), {
      onConflict: "trader_name,opened_at,coin",
      ignoreDuplicates: true,
    });
    if (error) throw error;
  }
  const { error } = await supabase.from("wallet_sync").upsert({
    trader_name: name,
    synced_until: fills.at(-1)!.time,
    open_positions: open,
  });
  if (error) throw error;
  console.log(
    `${name}: 종료된 포지션 ${toSave.length}건 기록, 진행 중 ${Object.keys(open).join(", ") || "없음"}`,
  );
}

for (const trader of WALLET_TRADERS) {
  await syncTrader(trader.name, trader.address);
}
