// 체인 보유자 쏠림 (TODO 39번 B): 관찰 후보·OI 급증 알림 코인의 BSC·이더리움 토큰 이체를 15분마다 받아 지갑별로 누적하고,
// 하루 한 번 "추적 시작 뒤 가장 많이 순매집한 지갑 10개"를 Supabase holder_daily에 남긴다.
// 과거 이체 기록은 무료로 못 받아서(공개 노드는 최근 몇 시간까지만, Dune 무료 계정 불가) 앞으로 쌓는 방식.
// 원본 이체는 하루 수만 건이라 저장하지 않고, 지갑별 누적값만 VM 파일(data/holders/)에 둔다.
// 두 체인에 다 있는 토큰은 실제 거래가 어느 쪽인지 몰라서 양쪽을 따로 기록한다.
// 실행: npm run holder-watch (Oracle VM의 systemd 타이머가 15분마다 돌린다)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import { EXCLUDED_WALLETS } from "./excluded.ts";

// 노드 한도는 2026-10-25 직접 확인: 둘 다 한 번에 블록 5000개·토큰 주소 10개까지.
// 받을 수 있는 과거는 BSC 약 1만 블록(약 1~2시간), 이더리움 5000 블록(약 16시간)까지 됐고 그보다 오래되면 거부.
// headMargin: 노드마다 최신 블록이 조금씩 달라서 그만큼 앞까지만 받는다
const CHAINS = {
  bsc: {
    rpc: "https://bsc-rpc.publicnode.com",
    platform: "binance-smart-chain",
    maxBehind: 10000,
    headMargin: 10,
  },
  eth: {
    rpc: "https://ethereum-rpc.publicnode.com",
    platform: "ethereum",
    maxBehind: 4000,
    headMargin: 3,
  },
};
type Chain = keyof typeof CHAINS;

const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const MAX_RANGE = 5000;
const MAX_ADDRESSES = 10;
const DIR = "data/holders";
const DAY = 86_400_000;

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface Token {
  coingeckoId: string | null;
  chains: Partial<Record<Chain, { address: string; decimals: number }>>; // 못 찾으면 비어 있음
  since: string; // 추적 시작일 (UTC)
  checkedAt: number; // 못 찾은 종목은 7일 뒤 다시 찾아봄
}

interface State {
  lastBlock: Partial<Record<Chain, number>>;
  lastSummary: string | null;
  tokens: Record<string, Token>;
  // 날짜 → "종목:체인" → 그날 움직인 지갑 수·처음 본 지갑 수
  daily: Record<string, Record<string, { active: number; fresh: number }>>;
  // 날짜 → 체인 → VM이 멈춰서 못 받은 블록 수
  missed: Record<string, Partial<Record<Chain, number>>>;
}

// 지갑 → [받은 양, 보낸 양, 처음 본 날, 마지막으로 본 날]
type Wallets = Record<string, [number, number, string, string]>;

const toDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const walletFile = (symbol: string, chain: Chain) => `${DIR}/${symbol}-${chain}.json`;

function readJson<T>(file: string, fallback: T): T {
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : fallback;
}

async function rpc(chain: Chain, method: string, params: unknown[]) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(CHAINS[chain].rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    // 한도 위반(주소 10개 초과 등)은 403과 함께 오류 내용이 와서, 다시 보내지 않고 바로 알린다
    const body = await res.json().catch(() => null);
    if (body?.error) throw new Error(`${chain} ${method}: ${body.error.message}`);
    if (res.ok) return body.result;
    await sleep(10_000 * attempt);
  }
  throw new Error(`${chain} RPC 응답 없음: ${method}`);
}

// 토큰 컨트랙트 함수 호출 (인자는 주소 하나까지)
async function callToken(chain: Chain, token: string, selector: string, address?: string) {
  const data = selector + (address ? address.slice(2).padStart(64, "0") : "");
  return BigInt(await rpc(chain, "eth_call", [{ to: token, data }, "latest"]));
}

async function json(url: string) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    await sleep(60_000); // CoinGecko 무료 한도 (분당 몇 번)
  }
  throw new Error(`요청 실패: ${url}`);
}

// 바이낸스 종목 → 체인별 컨트랙트. CoinGecko에서 기호가 같은 코인을 찾고, 가격이 바이낸스와 ±30% 안인 것만 인정한다
// (기호만 보면 ONE이 Harmony가 아니라 다른 코인으로, IOST가 BSC 복제 토큰으로 잡히는 것을 2026-10-25에 봄).
async function findToken(symbol: string, baseAsset: string) {
  const [, multiplier, coin] = baseAsset.match(/^(1000+)?(.+)$/)!; // 1000SATS = SATS 1000개
  const { price } = (await json(
    `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`,
  )) as { price: string };
  const binancePrice = Number(price) / Number(multiplier ?? 1);
  const search = (await json(
    `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(coin)}`,
  )) as { coins: { id: string; symbol: string }[] };
  const matches = search.coins
    .filter((c) => c.symbol.toUpperCase() === coin.toUpperCase())
    .slice(0, 3);
  for (const match of matches) {
    await sleep(6000);
    const detail = (await json(
      `https://api.coingecko.com/api/v3/coins/${match.id}?localization=false&tickers=false&community_data=false&developer_data=false`,
    )) as {
      platforms: Record<string, string>;
      market_data: { current_price: { usd?: number } | null } | null;
    };
    const cgPrice = detail.market_data?.current_price?.usd;
    if (!cgPrice || Math.abs(cgPrice / binancePrice - 1) > 0.3) continue;
    const chains: Token["chains"] = {};
    for (const chain of Object.keys(CHAINS) as Chain[]) {
      const address = detail.platforms[CHAINS[chain].platform]?.toLowerCase();
      if (!address) continue;
      const decimals = Number(await callToken(chain, address, "0x313ce567"));
      chains[chain] = { address, decimals };
    }
    if (Object.keys(chains).length > 0) return { coingeckoId: match.id, chains };
  }
  return { coingeckoId: null, chains: {} };
}

// 관찰 후보(가장 최근 날) + 지금까지의 OI 급증 알림 종목. 한 번 넣은 종목은 계속 추적한다 (기록이 끊기지 않게).
async function loadSymbols() {
  const { data: latest, error } = await supabase
    .from("mm_watchlist")
    .select("date")
    .order("date", { ascending: false })
    .limit(1);
  if (error) throw error;
  const { data: watch, error: watchError } = await supabase
    .from("mm_watchlist")
    .select("symbol")
    .eq("date", latest[0]?.date ?? "1970-01-01");
  if (watchError) throw watchError;
  const { data: alerts, error: alertError } = await supabase
    .from("oi_alerts")
    .select("symbol")
    .eq("kind", "alert");
  if (alertError) throw alertError;
  return new Set([...watch, ...alerts].map((r) => r.symbol as string));
}

async function addTokens(state: State) {
  const symbols = await loadSymbols();
  const todo = [...symbols].filter((s) => {
    const token = state.tokens[s];
    const empty = token && Object.keys(token.chains).length === 0;
    return !token || (empty && Date.now() - token.checkedAt > 7 * DAY);
  });
  if (todo.length === 0) return;
  const info = (await json("https://fapi.binance.com/fapi/v1/exchangeInfo")) as {
    symbols: { symbol: string; baseAsset: string }[];
  };
  for (const symbol of todo) {
    const baseAsset = info.symbols.find((s) => s.symbol === symbol)?.baseAsset;
    const found = baseAsset
      ? await findToken(symbol, baseAsset)
      : { coingeckoId: null, chains: {} };
    state.tokens[symbol] = { ...found, since: toDate(Date.now()), checkedAt: Date.now() };
    const where = Object.keys(found.chains).join("·") || "BSC·이더리움 토큰 못 찾음";
    console.log(`추적 추가: ${symbol} → ${where} (${found.coingeckoId ?? "-"})`);
    writeFileSync(`${DIR}/state.json`, JSON.stringify(state));
    await sleep(6000);
  }
}

type Log = { address: string; topics: string[]; data: string; blockTimestamp: string };

// 범위가 너무 커서 노드가 거절하면 반으로 나눠 다시 받는다
async function getLogs(
  chain: Chain,
  addresses: string[],
  from: number,
  to: number,
): Promise<Log[]> {
  try {
    return await rpc(chain, "eth_getLogs", [
      {
        address: addresses,
        topics: [TRANSFER],
        fromBlock: `0x${from.toString(16)}`,
        toBlock: `0x${to.toString(16)}`,
      },
    ]);
  } catch (error) {
    if (to - from < 100) throw error;
    const middle = Math.floor((from + to) / 2);
    return [
      ...(await getLogs(chain, addresses, from, middle)),
      ...(await getLogs(chain, addresses, middle + 1, to)),
    ];
  }
}

async function collect(state: State, chain: Chain) {
  const { maxBehind, headMargin } = CHAINS[chain];
  const tracked = Object.entries(state.tokens).filter(([, t]) => t.chains[chain]);
  const head = parseInt(await rpc(chain, "eth_blockNumber", []), 16) - headMargin;
  const last = state.lastBlock[chain];
  let from = last === undefined ? head - 100 : last + 1;
  if (head - from > maxBehind) {
    const missed = head - maxBehind - from;
    const day = (state.missed[toDate(Date.now())] ??= {});
    day[chain] = (day[chain] ?? 0) + missed;
    console.log(`${chain} 못 받은 블록 ${missed}개 (노드가 최근 블록까지만 줌)`);
    from = head - maxBehind;
  }
  if (tracked.length === 0 || from > head) {
    state.lastBlock[chain] = head;
    return;
  }

  const bySymbol = new Map(tracked.map(([symbol, t]) => [t.chains[chain]!.address, symbol]));
  const wallets = new Map(
    tracked.map(([symbol]) => [symbol, readJson<Wallets>(walletFile(symbol, chain), {})]),
  );
  const addresses = [...bySymbol.keys()];
  let count = 0;
  for (let start = from; start <= head; start += MAX_RANGE) {
    const end = Math.min(start + MAX_RANGE - 1, head);
    const logs: Log[] = [];
    for (let i = 0; i < addresses.length; i += MAX_ADDRESSES) {
      logs.push(...(await getLogs(chain, addresses.slice(i, i + MAX_ADDRESSES), start, end)));
    }
    for (const log of logs) {
      const symbol = bySymbol.get(log.address.toLowerCase());
      if (!symbol || log.topics.length !== 3) continue; // ERC-721 등 모양이 다른 Transfer 제외
      const { decimals } = state.tokens[symbol].chains[chain]!;
      const amount = Number(BigInt(log.data === "0x" ? 0 : log.data)) / 10 ** decimals;
      const date = toDate(parseInt(log.blockTimestamp, 16) * 1000);
      const day = ((state.daily[date] ??= {})[`${symbol}:${chain}`] ??= { active: 0, fresh: 0 });
      const book = wallets.get(symbol)!;
      for (const [index, topic] of [log.topics[1], log.topics[2]].entries()) {
        const address = `0x${topic.slice(26)}`;
        let wallet = book[address];
        if (!wallet) {
          wallet = book[address] = [0, 0, date, ""];
          day.fresh++;
        }
        // 이체는 시간순이라 "마지막으로 본 날"이 바뀔 때만 그날 처음 움직인 것
        if (wallet[3] !== date) {
          wallet[3] = date;
          day.active++;
        }
        wallet[index === 0 ? 1 : 0] += amount;
      }
      count++;
    }
  }
  for (const [symbol, book] of wallets)
    writeFileSync(walletFile(symbol, chain), JSON.stringify(book));
  state.lastBlock[chain] = head;
  console.log(`${chain} 블록 ${from}~${head} 이체 ${count}건, 추적 ${tracked.length}종목`);
}

// 어제(UTC)까지 하루 요약을 Supabase에 남긴다. 잔고는 요약하는 시점(다음 날 새벽)의 값.
async function summarize(state: State) {
  const yesterday = toDate(Date.now() - DAY);
  if (state.lastSummary !== null && state.lastSummary >= yesterday) return;
  for (const [symbol, token] of Object.entries(state.tokens)) {
    if (token.since > yesterday) continue;
    for (const [chain, { address: tokenAddress, decimals }] of Object.entries(token.chains) as [
      Chain,
      { address: string; decimals: number },
    ][]) {
      const book = readJson<Wallets>(walletFile(symbol, chain), {});
      const supply = Number(await callToken(chain, tokenAddress, "0x18160ddd")) / 10 ** decimals;
      const top = Object.entries(book)
        .filter(([address]) => address !== tokenAddress && !EXCLUDED_WALLETS.has(address))
        .map(([address, [received, sent]]) => ({ address, net: received - sent }))
        .sort((a, b) => b.net - a.net)
        .slice(0, 10);
      const top10: { address: string; net: number; balance: number; contract: boolean }[] = [];
      for (const wallet of top) {
        const raw = await callToken(chain, tokenAddress, "0x70a08231", wallet.address);
        // 컨트랙트(풀·브리지·멀티시그 등)인지 표시만 한다. 제외 여부는 손으로 확인한 뒤 excluded.ts에
        const contract = (await rpc(chain, "eth_getCode", [wallet.address, "latest"])) !== "0x";
        top10.push({ ...wallet, balance: Number(raw) / 10 ** decimals, contract });
      }
      const sum = (key: "net" | "balance") => top10.reduce((s, w) => s + w[key], 0);
      const counts = state.daily[yesterday]?.[`${symbol}:${chain}`];
      const { error } = await supabase.from("holder_daily").upsert(
        {
          date: yesterday,
          symbol,
          chain,
          token_address: tokenAddress,
          coingecko_id: token.coingeckoId,
          tracked_since: token.since,
          wallets: Object.keys(book).length,
          active_wallets: counts?.active ?? 0,
          new_wallets: counts?.fresh ?? 0,
          top10_net_pct: supply > 0 ? sum("net") / supply : null,
          top10_balance_pct: supply > 0 ? sum("balance") / supply : null,
          top10,
          missed_blocks: state.missed[yesterday]?.[chain] ?? 0,
        },
        { onConflict: "date,symbol,chain" },
      );
      if (error) throw error;
    }
  }
  state.lastSummary = yesterday;
  // 요약을 남긴 날짜의 카운터는 더 필요 없음
  for (const date of Object.keys(state.daily)) if (date <= yesterday) delete state.daily[date];
  console.log(`${yesterday} 하루 요약 저장`);
}

mkdirSync(DIR, { recursive: true });
const state = readJson<State>(`${DIR}/state.json`, {
  lastBlock: {},
  lastSummary: null,
  tokens: {},
  daily: {},
  missed: {},
});
await addTokens(state);
for (const chain of Object.keys(CHAINS) as Chain[]) await collect(state, chain);
await summarize(state);
writeFileSync(`${DIR}/state.json`, JSON.stringify(state));
