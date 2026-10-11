// 워뇨띠(BitMEX 계정 aoa) 2018-03~2021-12 실제 기록을 AI 워뇨띠 상세 페이지용 요약으로 만든다.
// 실행: node scripts/wonyotti-record.ts → src/lib/wonyottiRecord.json
// 원본 CSV(data/wonyotti/)는 다른 사람의 실제 거래 내역이라 git에 올리지 않고 로컬에만 둔다. 요약 숫자만 커밋한다.
import { createReadStream, readdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const DIR = "data/wonyotti/";
const HOUR_MS = 3_600_000;

function splitCsv(line: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      cells.push(cell);
      cell = "";
    } else cell += ch;
  }
  cells.push(cell);
  return cells;
}

// 스탑 주문 체결의 메모 칸에 줄바꿈이 있어서, 따옴표 짝이 맞을 때까지 다음 줄을 붙인다.
async function* readCsv(path: string) {
  let header: string[] | null = null;
  let buffer = "";
  for await (const line of createInterface({ input: createReadStream(path) })) {
    buffer = buffer ? `${buffer}\n${line}` : line.replace(/^﻿/, "");
    if ((buffer.match(/"/g)?.length ?? 0) % 2 === 1) continue;
    const cells = splitCsv(buffer);
    buffer = "";
    if (!header) header = cells;
    else yield Object.fromEntries(header.map((h, i) => [h, cells[i]]));
  }
}

const quantile = (values: number[], q: number) =>
  [...values].sort((a, b) => a - b)[Math.floor(q * (values.length - 1))];
const sum = <T>(items: T[], f: (item: T) => number) => items.reduce((s, x) => s + f(x), 0);
const round = (n: number, digits = 2) => Number(n.toFixed(digits));

// ---- 지갑: 입금·출금·실현손익·잔고 (지갑 CSV는 시각이 깨져 있어서 날짜만 쓴다) ----
const wallet: Record<string, string>[] = [];
for await (const row of readCsv(`${DIR}aoa-wallet-2018-03-01-2021-12-31.csv`)) {
  if (row.transactstatus === "Completed") wallet.push(row);
}
// 같은 날짜 안에서는 파일 순서를 유지한다 (안정 정렬)
wallet.sort((a, b) => a.date.localeCompare(b.date));
const btc = (row: Record<string, string>) => Number(row.amount) / 1e8;
const deposits = sum(
  wallet.filter((r) => r.transacttype === "Deposit"),
  btc,
);
const withdrawals = -sum(
  wallet.filter((r) => r.transacttype === "Withdrawal"),
  btc,
);
const realizedPnl = sum(
  wallet.filter((r) => r.transacttype === "RealisedPNL"),
  btc,
);

const monthly: { month: string; balance: number; withdrawn: number }[] = [];
let withdrawnSoFar = 0;
for (const row of wallet) {
  if (row.transacttype === "Withdrawal") withdrawnSoFar -= btc(row);
  const month = row.date.slice(0, 7);
  const entry = {
    month,
    balance: round(Number(row.walletbalance) / 1e8, 1),
    withdrawn: round(withdrawnSoFar, 1),
  };
  if (monthly.at(-1)?.month === month) monthly[monthly.length - 1] = entry;
  else monthly.push(entry);
}

const years = ["2018", "2019", "2020", "2021"];
const yearly = years.map((year) => {
  const rows = wallet.filter((r) => r.date.startsWith(year));
  return {
    year,
    pnl: round(
      sum(
        rows.filter((r) => r.transacttype === "RealisedPNL"),
        btc,
      ),
      1,
    ),
    withdrawn: round(
      -sum(
        rows.filter((r) => r.transacttype === "Withdrawal"),
        btc,
      ),
      1,
    ),
  };
});

const pnlBySymbol = new Map<string, number>();
for (const row of wallet.filter((r) => r.transacttype === "RealisedPNL")) {
  // 분기 선물(XBTZ18 등)은 한 줄로 묶는다
  const symbol = row.address.replace(/[A-Z]\d\d$/, " 분기선물").replace(/^XBT/, "BTC");
  pnlBySymbol.set(symbol, (pnlBySymbol.get(symbol) ?? 0) + btc(row));
}
const bySymbol = [...pnlBySymbol]
  .sort((a, b) => b[1] - a[1])
  .map(([symbol, pnl]) => ({ symbol, pnl: round(pnl, 1) }));

// ---- 체결: 주문 방식, XBTUSD 포지션 재구성 ----
let fills = 0;
let limitFills = 0;
let makerFills = 0;
const xbt: {
  time: number;
  qty: number;
  price: number;
  fee: number;
  orderId: string;
  stop: boolean;
  liquidation: boolean;
}[] = [];
for (const file of readdirSync(DIR)
  .filter((f) => f.includes("execution"))
  .sort()) {
  for await (const row of readCsv(DIR + file)) {
    if (row.exectype !== "Trade") continue;
    fills++;
    if (row.ordtype === "Limit") limitFills++;
    if (row.lastliquidityind === "AddedLiquidity") makerFills++;
    if (row.symbol !== "XBTUSD") continue;
    xbt.push({
      time: Date.parse(`${row.timestamp.replace(" ", "T")}Z`),
      qty: (row.side === "Buy" ? 1 : -1) * Number(row.lastqty),
      price: Number(row.lastpx),
      fee: Number(row.execcomm) / 1e8,
      orderId: row.orderid,
      stop: row.ordtype.startsWith("Stop"),
      liquidation: row.text === "Liquidation",
    });
  }
}
xbt.sort((a, b) => a.time - b.time);

// 0 → 보유 → 0 을 포지션 하나로. 방향이 바로 뒤집히면 청산 + 새 포지션으로 나눈다.
// XBTUSD는 1계약 = 1달러인 인버스 계약이라 손익(BTC) = 방향 × (1/진입가 − 1/청산가) × 계약 수.
interface Episode {
  start: number;
  end: number;
  dir: number;
  maxContracts: number;
  inQty: number;
  inInv: number;
  outQty: number;
  outInv: number;
  fee: number;
  orders: Set<string>;
  added: boolean;
  stop: boolean;
  liquidation: boolean;
}
const episodes: (Episode & { pnl: number; move: number; maxBtc: number })[] = [];
let position = 0;
let current: Episode | null = null;
const apply = (fill: (typeof xbt)[number], qty: number) => {
  if (!current)
    current = {
      start: fill.time,
      end: 0,
      dir: Math.sign(qty),
      maxContracts: 0,
      inQty: 0,
      inInv: 0,
      outQty: 0,
      outInv: 0,
      fee: 0,
      orders: new Set(),
      added: false,
      stop: false,
      liquidation: false,
    };
  const c: Episode = current;
  if (c.orders.size > 0 && !c.orders.has(fill.orderId) && Math.sign(qty) === c.dir) c.added = true;
  c.orders.add(fill.orderId);
  c.fee += (fill.fee * Math.abs(qty)) / Math.abs(fill.qty);
  c.stop ||= fill.stop;
  c.liquidation ||= fill.liquidation;
  if (Math.sign(qty) === c.dir) {
    c.inQty += Math.abs(qty);
    c.inInv += Math.abs(qty) / fill.price;
  } else {
    c.outQty += Math.abs(qty);
    c.outInv += Math.abs(qty) / fill.price;
  }
  position += qty;
  c.maxContracts = Math.max(c.maxContracts, Math.abs(position));
  if (position === 0) {
    const entry = c.inQty / c.inInv;
    const exit = c.outQty / c.outInv;
    episodes.push({
      ...c,
      end: fill.time,
      pnl: c.dir * (c.inInv - c.outInv) - c.fee,
      move: c.dir * (exit / entry - 1),
      maxBtc: c.maxContracts / entry,
    });
    current = null;
  }
};
for (const fill of xbt) {
  if (position !== 0 && Math.sign(position + fill.qty) === -Math.sign(position)) {
    const closing = -position;
    apply(fill, closing);
    apply(fill, fill.qty - closing);
  } else apply(fill, fill.qty);
}

const hours = (e: { start: number; end: number }) => (e.end - e.start) / HOUR_MS;
const wins = episodes.filter((e) => e.pnl > 0);
const losses = episodes.filter((e) => e.pnl <= 0);
const totalXbt = sum(episodes, (e) => e.pnl);
const byPnl = [...episodes].sort((a, b) => b.pnl - a.pnl);
const top1Count = Math.ceil(episodes.length * 0.01);

const holdBuckets = [
  { label: "1시간 미만", from: 0, to: 1 },
  { label: "1~24시간", from: 1, to: 24 },
  { label: "1~7일", from: 24, to: 168 },
  { label: "7일 이상", from: 168, to: Infinity },
].map(({ label, from, to }) => {
  const items = episodes.filter((e) => hours(e) >= from && hours(e) < to);
  return {
    label,
    count: items.length,
    pnl: round(
      sum(items, (e) => e.pnl),
      1,
    ),
    winRate: round((items.filter((e) => e.pnl > 0).length / items.length) * 100, 0),
    medianBtc: round(
      quantile(
        items.map((e) => e.maxBtc),
        0.5,
      ),
      1,
    ),
  };
});

const describe = (e: (typeof episodes)[number]) => ({
  date: new Date(e.start).toISOString().slice(0, 10),
  direction: e.dir > 0 ? "롱" : "숏",
  pnl: round(e.pnl, 1),
  hours: round(hours(e), 0),
  maxBtc: round(e.maxBtc, 0),
});

const record = {
  period: { from: "2018-03-05", to: "2021-12-24" },
  totals: {
    deposits: round(deposits, 1),
    realizedPnl: round(realizedPnl, 0),
    withdrawals: round(withdrawals, 0),
    endBalance: round(monthly.at(-1)!.balance, 0),
  },
  monthly,
  yearly,
  bySymbol: bySymbol.slice(0, 8),
  habits: {
    fills,
    limitShare: round((limitFills / fills) * 100, 1),
    makerShare: round((makerFills / fills) * 100, 0),
    positions: episodes.length,
    longShare: round((episodes.filter((e) => e.dir > 0).length / episodes.length) * 100, 0),
    winRate: round((wins.length / episodes.length) * 100, 0),
    avgWin: round(sum(wins, (e) => e.pnl) / wins.length, 2),
    avgLoss: round(-sum(losses, (e) => e.pnl) / losses.length, 2),
    medianHoldMinutes: round(quantile(episodes.map(hours), 0.5) * 60, 0),
    medianWinMove: round(
      quantile(
        wins.map((e) => e.move),
        0.5,
      ) * 100,
      2,
    ),
    addedShare: round((episodes.filter((e) => e.added).length / episodes.length) * 100, 0),
    stopPositions: episodes.filter((e) => e.stop).length,
    liquidationPositions: episodes.filter((e) => e.liquidation).length,
    top1Count,
    top1Share: round((sum(byPnl.slice(0, top1Count), (e) => e.pnl) / totalXbt) * 100, 0),
  },
  holdBuckets,
  bestTrades: byPnl.slice(0, 5).map(describe),
  worstTrades: byPnl.slice(-5).reverse().map(describe),
};

writeFileSync("src/lib/wonyottiRecord.json", `${JSON.stringify(record, null, 2)}\n`);
console.log(JSON.stringify(record.totals), JSON.stringify(record.habits));
