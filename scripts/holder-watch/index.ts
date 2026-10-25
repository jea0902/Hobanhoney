// 체인 보유자 쏠림 (TODO 39번 B): 관찰 후보·OI 급증 알림 코인의 토큰을 체인별로 추적해서, 하루 한 번
// "순매집 상위 100개 지갑"과 "잔고 상위 100개 지갑"이 총발행량의 몇 %인지 Supabase holder_daily에 남긴다.
// - EVM 체인: 과거 이체 기록을 무료로 못 받아서(공개 노드는 최근 몇 시간~며칠까지만, Dune 무료 계정 불가) 15분마다 새 이체를
//   받아 지갑별로 누적한다. 그래서 추적 시작 전부터 가만히 들고 있는 지갑은 움직이기 전까지 안 보인다.
// - 솔라나: 보유자 전체 목록을 하루 한 번 통째로 받을 수 있어서(getProgramAccounts) 그날 목록과 첫 목록의 차이로 순매집을 센다.
// 원본 이체·목록은 저장하지 않고, 지갑별 누적값만 VM 파일(data/holders/)에 둔다.
// 여러 체인에 다 있는 토큰은 실제 거래가 어느 쪽인지 몰라서 체인마다 따로 기록한다.
// 실행: npm run holder-watch (Oracle VM의 systemd 타이머가 15분마다 돌린다)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import { EXCLUDED_WALLETS } from "./excluded.ts";

// 노드 한도는 2026-10-25 직접 확인: 한 번에 블록 5000개·토큰 주소 10개, 묶음 요청 50개까지 (Arbitrum 공식 노드는 200개에서 429).
// maxBehind: 이보다 오래된 블록은 노드가 거부해서, VM이 그보다 오래 멈추면 그 구간은 영영 빠진다 (BSC 약 2시간, 이더리움 약 13시간).
// headMargin: 노드마다 최신 블록이 조금씩 달라서 그만큼 앞까지만 받는다
const EVM_CHAINS = {
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
  base: {
    rpc: "https://base-rpc.publicnode.com",
    platform: "base",
    maxBehind: 40000,
    headMargin: 10,
  },
  // publicnode의 Arbitrum은 최근 블록도 거부해서 공식 노드를 쓴다
  arbitrum: {
    rpc: "https://arb1.arbitrum.io/rpc",
    platform: "arbitrum-one",
    maxBehind: 200000,
    headMargin: 20,
  },
  polygon: {
    rpc: "https://polygon-bor-rpc.publicnode.com",
    platform: "polygon-pos",
    maxBehind: 15000,
    headMargin: 10,
  },
  avalanche: {
    rpc: "https://avalanche-c-chain-rpc.publicnode.com",
    platform: "avalanche",
    maxBehind: 15000,
    headMargin: 5,
  },
  optimism: {
    rpc: "https://optimism-rpc.publicnode.com",
    platform: "optimistic-ethereum",
    maxBehind: 4000,
    headMargin: 10,
  },
};
type EvmChain = keyof typeof EVM_CHAINS;
type Chain = EvmChain | "sol";
const SOLANA_RPC = "https://api.mainnet-beta.solana.com"; // publicnode 솔라나는 이 요청에 개인 토큰을 요구함

const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const MAX_RANGE = 5000;
const MAX_ADDRESSES = 10;
const BATCH = 50;
const TOP = 100;
const LOOKUP_VERSION = 2; // 체인을 늘릴 때 올리면 이미 넣은 종목도 컨트랙트를 다시 찾는다
const DIR = "data/holders";
const DAY = 86_400_000;

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface TokenChain {
  address: string; // EVM 컨트랙트(소문자) 또는 솔라나 mint
  decimals: number;
  since?: string; // 이 체인 추적 시작일 (없으면 종목 추적 시작일)
}

interface Token {
  coingeckoId: string | null;
  chains: Partial<Record<Chain, TokenChain>>; // 못 찾으면 비어 있음
  since: string; // 추적 시작일 (UTC)
  checkedAt: number; // 못 찾은 종목은 7일 뒤 다시 찾아봄
  lookup?: number;
}

interface State {
  lastBlock: Partial<Record<EvmChain, number>>;
  lastSummary: string | null;
  tokens: Record<string, Token>;
  // 날짜 → "종목:체인" → 그날 움직인 지갑 수·처음 본 지갑 수 (EVM만, 솔라나는 목록끼리 비교)
  daily: Record<string, Record<string, { active: number; fresh: number }>>;
  // 날짜 → 체인 → VM이 멈춰서 못 받은 블록 수
  missed: Record<string, Partial<Record<EvmChain, number>>>;
}

// EVM 지갑 → [받은 양, 보낸 양, 처음 본 날, 마지막으로 본 날, 잔고(요약 때 조회), 컨트랙트 여부]
type Wallets = Record<string, [number, number, string, string, number?, boolean?]>;

interface Ranked {
  address: string;
  net: number;
  balance: number;
}

const toDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const walletFile = (symbol: string, chain: Chain, suffix = "") =>
  `${DIR}/${symbol}-${chain}${suffix}.json`;

function readJson<T>(file: string, fallback: T): T {
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : fallback;
}

async function post(url: string, body: unknown) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    // 한도 위반(주소 10개 초과 등)은 403과 함께 오류 내용이 와서, 다시 보내지 않고 바로 알린다. 429는 잠시 뒤 다시.
    const json = await res.json().catch(() => null);
    if (res.ok || (json?.error && res.status !== 429)) return json;
    await sleep(15_000 * attempt);
  }
  throw new Error(`RPC 응답 없음: ${url}`);
}

async function rpc(url: string, method: string, params: unknown[]) {
  const json = await post(url, { jsonrpc: "2.0", id: 1, method, params });
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
}

// 같은 요청 여러 개를 50개씩 묶어 보낸다 (지갑 잔고·코드 조회가 하루 수천 번이라)
async function rpcBatch(url: string, calls: { method: string; params: unknown[] }[]) {
  const results: unknown[] = [];
  for (let i = 0; i < calls.length; i += BATCH) {
    const body = calls
      .slice(i, i + BATCH)
      .map((c, j) => ({ jsonrpc: "2.0", id: j, method: c.method, params: c.params }));
    const json = (await post(url, body)) as {
      id: number;
      result?: unknown;
      error?: { message: string };
    }[];
    if (!Array.isArray(json))
      throw new Error(`묶음 요청 실패: ${JSON.stringify(json).slice(0, 200)}`);
    for (const item of json.sort((a, b) => a.id - b.id)) {
      if (item.error) throw new Error(`묶음 요청 오류: ${item.error.message}`);
      results.push(item.result);
    }
    await sleep(300);
  }
  return results;
}

const balanceOfData = (address: string) => `0x70a08231${address.slice(2).padStart(64, "0")}`;

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
    for (const chain of Object.keys(EVM_CHAINS) as EvmChain[]) {
      const address = detail.platforms[EVM_CHAINS[chain].platform]?.toLowerCase();
      if (!address) continue;
      const decimals = Number(
        await rpc(EVM_CHAINS[chain].rpc, "eth_call", [
          { to: address, data: "0x313ce567" },
          "latest",
        ]),
      );
      chains[chain] = { address, decimals };
    }
    const mint = detail.platforms.solana;
    if (mint) {
      const supply = (await rpc(SOLANA_RPC, "getTokenSupply", [mint])) as {
        value: { decimals: number };
      };
      chains.sol = { address: mint, decimals: supply.value.decimals };
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
    if (!token) return true;
    if (token.lookup !== LOOKUP_VERSION) return true;
    return Object.keys(token.chains).length === 0 && Date.now() - token.checkedAt > 7 * DAY;
  });
  if (todo.length === 0) return;
  const info = (await json("https://fapi.binance.com/fapi/v1/exchangeInfo")) as {
    symbols: { symbol: string; baseAsset: string }[];
  };
  const today = toDate(Date.now());
  for (const symbol of todo) {
    const old = state.tokens[symbol];
    const baseAsset = info.symbols.find((s) => s.symbol === symbol)?.baseAsset;
    const found = baseAsset
      ? await findToken(symbol, baseAsset)
      : { coingeckoId: null, chains: {} };
    // 이미 추적 중인 체인은 그대로 두고(누적이 끊기지 않게), 새로 찾은 체인만 오늘부터 추적
    const chains: Token["chains"] = { ...old?.chains };
    for (const [chain, entry] of Object.entries(found.chains) as [Chain, TokenChain][]) {
      chains[chain] ??= old ? { ...entry, since: today } : entry;
    }
    state.tokens[symbol] = {
      coingeckoId: found.coingeckoId ?? old?.coingeckoId ?? null,
      chains,
      since: old?.since ?? today,
      checkedAt: Date.now(),
      lookup: LOOKUP_VERSION,
    };
    console.log(
      `추적: ${symbol} → ${Object.keys(chains).join("·") || "토큰 못 찾음"} (${found.coingeckoId ?? "-"})`,
    );
    writeFileSync(`${DIR}/state.json`, JSON.stringify(state));
    await sleep(6000);
  }
}

type Log = {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  blockTimestamp?: string;
};

// 범위가 너무 크거나 결과가 너무 많아서 노드가 거절하면 반으로 나눠 다시 받는다
async function getLogs(url: string, addresses: string[], from: number, to: number): Promise<Log[]> {
  try {
    return await rpc(url, "eth_getLogs", [
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
      ...(await getLogs(url, addresses, from, middle)),
      ...(await getLogs(url, addresses, middle + 1, to)),
    ];
  }
}

async function collect(state: State, chain: EvmChain) {
  const { rpc: url, maxBehind, headMargin } = EVM_CHAINS[chain];
  const tracked = Object.entries(state.tokens).filter(([, t]) => t.chains[chain]);
  if (tracked.length === 0) return;
  const head = parseInt(await rpc(url, "eth_blockNumber", []), 16) - headMargin;
  const last = state.lastBlock[chain];
  let from = last === undefined ? head - 100 : last + 1;
  if (head - from > maxBehind) {
    const missed = head - maxBehind - from;
    const day = (state.missed[toDate(Date.now())] ??= {});
    day[chain] = (day[chain] ?? 0) + missed;
    console.log(`${chain} 못 받은 블록 ${missed}개 (노드가 최근 블록까지만 줌)`);
    from = head - maxBehind;
  }
  if (from > head) return;

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
      logs.push(...(await getLogs(url, addresses.slice(i, i + MAX_ADDRESSES), start, end)));
    }
    // Avalanche 노드는 이체 기록에 블록 시각을 안 붙여주고, Arbitrum 공식 노드는 0x0으로 줘서 그 블록만 따로 조회한다
    const hasTime = (l: Log) => !!l.blockTimestamp && parseInt(l.blockTimestamp, 16) > 0;
    const missing = [...new Set(logs.filter((l) => !hasTime(l)).map((l) => l.blockNumber))];
    const blocks = (await rpcBatch(
      url,
      missing.map((n) => ({ method: "eth_getBlockByNumber", params: [n, false] })),
    )) as { timestamp: string }[];
    const blockTimes = new Map(missing.map((n, i) => [n, blocks[i].timestamp]));
    for (const log of logs) {
      const symbol = bySymbol.get(log.address.toLowerCase());
      if (!symbol || log.topics.length !== 3) continue; // ERC-721 등 모양이 다른 Transfer 제외
      const { decimals } = state.tokens[symbol].chains[chain]!;
      const amount = Number(BigInt(log.data === "0x" ? 0 : log.data)) / 10 ** decimals;
      const timestamp = hasTime(log) ? log.blockTimestamp! : blockTimes.get(log.blockNumber)!;
      const date = toDate(parseInt(timestamp, 16) * 1000);
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

// 정렬된 후보에서 컨트랙트(풀·브리지·거래소 컨트랙트·멀티시그 등)를 빼고 위에서 100개. isContract는 모르는 것만 조회해서 채운다.
async function topWallets(
  sorted: Ranked[],
  isContract: (address: string) => boolean | undefined,
  check: (addresses: string[]) => Promise<void>,
) {
  const picked: Ranked[] = [];
  let excluded = 0;
  for (let i = 0; i < sorted.length && picked.length < TOP; i += BATCH) {
    const chunk = sorted.slice(i, i + BATCH);
    const unknown = chunk.filter((w) => isContract(w.address) === undefined).map((w) => w.address);
    if (unknown.length > 0) await check(unknown);
    for (const wallet of chunk) {
      if (picked.length === TOP) break;
      if (isContract(wallet.address)) excluded++;
      else picked.push(wallet);
    }
  }
  return { picked, excluded };
}

interface Summary {
  wallets: number;
  active: number;
  fresh: number;
  net: Ranked[]; // 순매집 상위 100 (컨트랙트 제외)
  holders: Ranked[]; // 잔고 상위 100 (컨트랙트 제외)
  excluded: number;
  supply: number;
}

async function summarizeEvm(
  state: State,
  symbol: string,
  chain: EvmChain,
  token: TokenChain,
  date: string,
): Promise<Summary> {
  const url = EVM_CHAINS[chain].rpc;
  const book = readJson<Wallets>(walletFile(symbol, chain), {});
  // 지난 요약 뒤에 움직인 지갑만 잔고를 다시 조회한다 (안 움직였으면 잔고도 그대로)
  const stale = Object.keys(book).filter(
    (a) => book[a][4] === undefined || state.lastSummary === null || book[a][3] > state.lastSummary,
  );
  const balances = await rpcBatch(
    url,
    stale.map((a) => ({
      method: "eth_call",
      params: [{ to: token.address, data: balanceOfData(a) }, "latest"],
    })),
  );
  // 잔고 함수가 이상한 토큰은 "0x"를 돌려줘서 0으로 본다
  stale.forEach((a, i) => {
    const raw = balances[i] as string;
    book[a][4] = raw && raw !== "0x" ? Number(BigInt(raw)) / 10 ** token.decimals : 0;
  });

  const candidates = Object.entries(book)
    .filter(([a]) => a !== token.address && !EXCLUDED_WALLETS.has(a))
    .map(([address, w]) => ({ address, net: w[0] - w[1], balance: w[4] ?? 0 }));
  const isContract = (a: string) => book[a][5];
  const check = async (addresses: string[]) => {
    const codes = await rpcBatch(
      url,
      addresses.map((a) => ({ method: "eth_getCode", params: [a, "latest"] })),
    );
    // 0xef0100으로 시작하는 코드는 일반 지갑이 다른 코드를 위임한 것(EIP-7702)이라 지갑으로 본다
    addresses.forEach((a, i) => {
      const code = codes[i] as string;
      book[a][5] = code !== "0x" && !code.startsWith("0xef0100");
    });
  };
  const net = await topWallets(
    [...candidates].sort((a, b) => b.net - a.net),
    isContract,
    check,
  );
  const holders = await topWallets(
    [...candidates].sort((a, b) => b.balance - a.balance),
    isContract,
    check,
  );
  writeFileSync(walletFile(symbol, chain), JSON.stringify(book));

  const supplyRaw = await rpc(url, "eth_call", [
    { to: token.address, data: "0x18160ddd" },
    "latest",
  ]);
  const counts = state.daily[date]?.[`${symbol}:${chain}`];
  return {
    wallets: Object.keys(book).length,
    active: counts?.active ?? 0,
    fresh: counts?.fresh ?? 0,
    net: net.picked,
    holders: holders.picked,
    excluded: Object.values(book).filter((w) => w[5]).length,
    supply: Number(BigInt(supplyRaw)) / 10 ** token.decimals,
  };
}

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58(hex: string) {
  let n = BigInt(`0x${hex}`);
  let out = "";
  while (n > BigInt(0)) {
    out = BASE58[Number(n % BigInt(58))] + out;
    n /= BigInt(58);
  }
  for (let i = 0; i < hex.length && hex.slice(i, i + 2) === "00"; i += 2) out = `1${out}`;
  return out;
}

const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

// 솔라나 토큰 보유자 전체: 지갑(owner, 16진수) → 잔고. 한 지갑이 토큰 계정을 여러 개 가질 수 있어서 합친다.
async function solanaHolders(mint: string, decimals: number) {
  const info = (await rpc(SOLANA_RPC, "getAccountInfo", [
    mint,
    { encoding: "base64", dataSlice: { offset: 0, length: 0 } },
  ])) as {
    value: { owner: string };
  };
  const program = info.value.owner; // 기존 토큰 프로그램 또는 Token-2022
  // 토큰 계정: 앞 32바이트 mint, 다음 32바이트 owner, 다음 8바이트 잔고. Token-2022의 확장 계정은 165번째 바이트가 2(계정 종류)
  const filterSets: unknown[][] = [[{ dataSize: 165 }, { memcmp: { offset: 0, bytes: mint } }]];
  if (program !== TOKEN_PROGRAM)
    filterSets.push([
      { memcmp: { offset: 0, bytes: mint } },
      { memcmp: { offset: 165, bytes: "3" } },
    ]);
  const holders = new Map<string, number>();
  for (const filters of filterSets) {
    const accounts = (await rpc(SOLANA_RPC, "getProgramAccounts", [
      program,
      { encoding: "base64", dataSlice: { offset: 32, length: 40 }, filters },
    ])) as { account: { data: [string, string] } }[];
    for (const { account } of accounts) {
      const bytes = Buffer.from(account.data[0], "base64");
      const owner = bytes.subarray(0, 32).toString("hex");
      const amount = Number(bytes.readBigUInt64LE(32)) / 10 ** decimals;
      if (amount > 0) holders.set(owner, (holders.get(owner) ?? 0) + amount);
    }
    await sleep(5000);
  }
  const supply = (await rpc(SOLANA_RPC, "getTokenSupply", [mint])) as {
    value: { uiAmount: number };
  };
  return { holders, supply: supply.value.uiAmount };
}

// 첫 목록(추적 시작)과 비교한 잔고 변화가 순매집, 어제 목록과 비교해 새 지갑·움직인 지갑을 센다
async function summarizeSolana(symbol: string, token: TokenChain): Promise<Summary> {
  const { holders, supply } = await solanaHolders(token.address, token.decimals);
  const now = Object.fromEntries(holders);
  const firstFile = walletFile(symbol, "sol", "-first");
  const lastFile = walletFile(symbol, "sol", "-last");
  if (!existsSync(firstFile)) writeFileSync(firstFile, JSON.stringify(now));
  const first = readJson<Record<string, number>>(firstFile, {});
  const last = readJson<Record<string, number>>(lastFile, now);
  const contracts = readJson<Record<string, boolean>>(walletFile(symbol, "sol", "-contracts"), {});

  const candidates = Object.entries(now).map(([hex, balance]) => ({
    address: hex,
    net: balance - (first[hex] ?? 0),
    balance,
  }));
  const isContract = (hex: string) => contracts[hex];
  // 지갑 주소의 계정이 시스템 프로그램 소유면 사람 지갑, 아니면(풀·프로그램 주소, 계정 없음) 컨트랙트로 본다
  const check = async (hexes: string[]) => {
    const result = (await rpc(SOLANA_RPC, "getMultipleAccounts", [
      hexes.map(base58),
      { encoding: "base64", dataSlice: { offset: 0, length: 0 } },
    ])) as { value: ({ owner: string } | null)[] };
    hexes.forEach((hex, i) => (contracts[hex] = result.value[i]?.owner !== SYSTEM_PROGRAM));
    await sleep(1000);
  };
  const net = await topWallets(
    [...candidates].sort((a, b) => b.net - a.net),
    isContract,
    check,
  );
  const holdersTop = await topWallets(
    [...candidates].sort((a, b) => b.balance - a.balance),
    isContract,
    check,
  );
  writeFileSync(walletFile(symbol, "sol", "-contracts"), JSON.stringify(contracts));
  writeFileSync(lastFile, JSON.stringify(now));

  const changed = Object.keys(now).filter((hex) => now[hex] !== last[hex]).length;
  const gone = Object.keys(last).filter((hex) => !(hex in now)).length;
  const toAddress = (w: Ranked) => ({ ...w, address: base58(w.address) });
  return {
    wallets: holders.size,
    active: changed + gone,
    fresh: Object.keys(now).filter((hex) => !(hex in last)).length,
    net: net.picked.map(toAddress),
    holders: holdersTop.picked.map(toAddress),
    excluded: Object.values(contracts).filter(Boolean).length,
    supply,
  };
}

// 종목 상태 (검증 전 규칙, 2026-10-25 사용자 동의): 7일 전과 비교해서
// - 조용한 매집: 순매집 상위 100의 순매집이 유통량의 +0.5%p 이상 늘었는데 가격은 ±10% 안
// - 분산: 잔고 상위 100의 보유가 유통량의 -0.5%p 이상 줄었는데 가격은 오름
// 상태마다 30일 안 펌핑 여부를 채워서 이 규칙이 맞는지 나중에 확인한다.
const STATUS_DAYS = 7;
const STATUS_CHANGE = 0.005;
const STATUS_PRICE_FLAT = 0.1;
const AHEAD_DAYS = 30;

interface CoinTotals {
  chains: string[];
  net: number;
  netBalance: number;
  holders: number;
  fresh: number;
  active: number;
}

// CoinGecko 유통량 (한 번에 250개까지). 체인마다 발행량이 달라서(브리지로 옮겨진 양만 있음) 체인을 합칠 때 분모로 쓴다.
async function getCirculatingSupply(ids: string[]) {
  const supply = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 250) {
    const rows = (await json(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=250&ids=${ids.slice(i, i + 250).join(",")}`,
    )) as { id: string; circulating_supply: number | null }[];
    for (const row of rows) if (row.circulating_supply) supply.set(row.id, row.circulating_supply);
  }
  return supply;
}

// 바이낸스 선물 그날(UTC) 일봉 종가
async function getClose(symbol: string, date: string) {
  const candles = (await json(
    `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1d&startTime=${Date.parse(date)}&limit=1`,
  )) as string[][];
  return candles.length > 0 ? Number(candles[0][4]) : null;
}

async function saveCoin(
  symbol: string,
  date: string,
  totals: CoinTotals,
  circulating: number | null,
) {
  const price = await getClose(symbol, date);
  const weekAgo = toDate(Date.parse(date) - STATUS_DAYS * DAY);
  const { data: history, error } = await supabase
    .from("holder_coin_daily")
    .select("date, price, net100_amount, holder100_amount")
    .eq("symbol", symbol)
    .gte("date", weekAgo)
    .lt("date", date)
    .order("date");
  if (error) throw error;
  const base = history.find((h) => h.date === weekAgo);
  let status = `데이터 쌓는 중 (${history.length + 1}/${STATUS_DAYS + 1}일)`;
  let netChange: number | null = null;
  let holderChange: number | null = null;
  let priceChange: number | null = null;
  if (base && circulating && price && base.price) {
    netChange = (totals.net - base.net100_amount) / circulating;
    holderChange = (totals.holders - base.holder100_amount) / circulating;
    priceChange = price / base.price - 1;
    if (netChange >= STATUS_CHANGE && Math.abs(priceChange) <= STATUS_PRICE_FLAT)
      status = "조용한 매집";
    else if (holderChange <= -STATUS_CHANGE && priceChange > 0) status = "분산";
    else status = "중립";
  } else if (base) {
    status = "판단 불가 (유통량·가격 없음)";
  }
  const { error: saveError } = await supabase.from("holder_coin_daily").upsert(
    {
      date,
      symbol,
      chains: totals.chains.join(","),
      price,
      circulating_supply: circulating,
      net100_amount: totals.net,
      net100_balance_amount: totals.netBalance,
      holder100_amount: totals.holders,
      new_wallets: totals.fresh,
      active_wallets: totals.active,
      status,
      net100_change_7d: netChange,
      holder100_change_7d: holderChange,
      price_change_7d: priceChange,
    },
    { onConflict: "date,symbol" },
  );
  if (saveError) throw saveError;
}

// 38일 지난 기록에 30일 안 펌핑(그날 종가 대비 이후 7일 안 종가 2배)이 시작됐는지 채운다. 관찰 후보와 같은 정의.
async function fillResults() {
  const { data: rows, error } = await supabase
    .from("holder_coin_daily")
    .select("id, symbol, date")
    .is("pumped_30d", null)
    .lte("date", toDate(Date.now() - (AHEAD_DAYS + 8) * DAY));
  if (error) throw error;
  for (const row of rows) {
    const candles = (await json(
      `https://fapi.binance.com/fapi/v1/klines?symbol=${row.symbol}&interval=1d&startTime=${Date.parse(row.date) + DAY}&limit=${AHEAD_DAYS + 7}`,
    )) as string[][];
    if (candles.length < AHEAD_DAYS + 7) continue; // 상장 폐지 등으로 봉이 모자라면 다음에 다시 봄
    const closes = candles.map((c) => Number(c[4]));
    const pumped = closes
      .slice(0, AHEAD_DAYS)
      .some((close, j) => Math.max(...closes.slice(j + 1, j + 8)) >= 2 * close);
    const { error: updateError } = await supabase
      .from("holder_coin_daily")
      .update({ pumped_30d: pumped, max_close_37d: Math.max(...closes) })
      .eq("id", row.id);
    if (updateError) throw updateError;
    await sleep(200);
  }
}

// 어제(UTC)까지 하루 요약을 Supabase에 남긴다. 잔고는 요약하는 시점(다음 날 새벽)의 값.
// holder_daily = 체인별 상세(그 체인 발행량 대비), holder_coin_daily = 종목별 합계(유통량 대비)와 상태.
async function summarize(state: State) {
  const yesterday = toDate(Date.now() - DAY);
  if (state.lastSummary !== null && state.lastSummary >= yesterday) return;
  const ids = [
    ...new Set(
      Object.values(state.tokens)
        .map((t) => t.coingeckoId)
        .filter((id) => id !== null),
    ),
  ];
  const circulating = await getCirculatingSupply(ids as string[]);
  for (const [symbol, token] of Object.entries(state.tokens)) {
    const totals: CoinTotals = {
      chains: [],
      net: 0,
      netBalance: 0,
      holders: 0,
      fresh: 0,
      active: 0,
    };
    for (const [chain, entry] of Object.entries(token.chains) as [Chain, TokenChain][]) {
      const since = entry.since ?? token.since;
      // EVM은 그날 하루를 다 받은 뒤라야 의미가 있고, 솔라나는 목록을 받는 날부터 시작
      if (chain !== "sol" && since > yesterday) continue;
      let summary: Summary;
      try {
        summary =
          chain === "sol"
            ? await summarizeSolana(symbol, entry)
            : await summarizeEvm(state, symbol, chain, entry, yesterday);
      } catch (error) {
        console.log(`${symbol} ${chain} 요약 실패: ${(error as Error).message}`);
        continue;
      }
      const sum = (list: Ranked[], key: "net" | "balance") => list.reduce((s, w) => s + w[key], 0);
      const pct = (value: number) => (summary.supply > 0 ? value / summary.supply : null);
      const { error } = await supabase.from("holder_daily").upsert(
        {
          date: yesterday,
          symbol,
          chain,
          token_address: entry.address,
          coingecko_id: token.coingeckoId,
          tracked_since: chain === "sol" && since > yesterday ? yesterday : since,
          wallets: summary.wallets,
          active_wallets: summary.active,
          new_wallets: summary.fresh,
          net100_pct: pct(sum(summary.net, "net")),
          net100_balance_pct: pct(sum(summary.net, "balance")),
          holder100_pct: pct(sum(summary.holders, "balance")),
          contracts_excluded: summary.excluded,
          // 손 확인용으로 각 목록의 위 10개만 (100개 전부는 1년이면 Supabase 무료 용량을 넘김)
          top_wallets: { net: summary.net.slice(0, 10), holders: summary.holders.slice(0, 10) },
          missed_blocks: chain === "sol" ? 0 : (state.missed[yesterday]?.[chain] ?? 0),
        },
        { onConflict: "date,symbol,chain" },
      );
      if (error) throw error;
      // 종목 합계: 체인마다 상위 100을 따로 뽑아 더한 값 (체인을 넘나든 상위 100과는 조금 다름)
      totals.chains.push(chain);
      totals.net += sum(summary.net, "net");
      totals.netBalance += sum(summary.net, "balance");
      totals.holders += sum(summary.holders, "balance");
      totals.fresh += summary.fresh;
      totals.active += summary.active;
    }
    if (totals.chains.length > 0) {
      await saveCoin(symbol, yesterday, totals, circulating.get(token.coingeckoId ?? "") ?? null);
    }
  }
  await fillResults();
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
for (const chain of Object.keys(EVM_CHAINS) as EvmChain[]) {
  try {
    await collect(state, chain);
  } catch (error) {
    // 한 체인 노드가 잠깐 막혀도 다른 체인은 계속 받는다 (못 받은 구간은 다음 실행에서 이어 받음)
    console.log(`${chain} 이체 받기 실패: ${(error as Error).message}`);
  }
}
// 요약이 실패해도 받은 블록 위치는 남겨야 같은 이체를 두 번 세지 않는다
writeFileSync(`${DIR}/state.json`, JSON.stringify(state));
await summarize(state);
writeFileSync(`${DIR}/state.json`, JSON.stringify(state));
