// 실행: npm run agent            (DB에 반영)
//       npm run agent -- --dry-run (DB에 쓰지 않고 판단 결과만 출력)
import { createHash } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import type { PositionRow } from "../../src/types/position.ts";
import { LIVE_CHECK_INTERVAL_MS, POLL_INTERVAL_MS, TRADERS } from "./config.ts";
import { closePosition, getOpenRows, logAgent, openPosition, updatePosition } from "./db.ts";
import { readScreen } from "./gemma.ts";
import type { ScreenReading } from "./gemma.ts";
import { getMarkPrice, getPriceRange } from "./market.ts";
import { isConsistent, isSameReading, planActions, positionKey } from "./rules.ts";
import type { Action } from "./rules.ts";
import { fetchLiveThumbnail, getLiveVideoId } from "./youtube.ts";

const DRY_RUN = process.argv.includes("--dry-run");

interface TraderState {
  liveVideoId: string | null;
  liveCheckedAt: number;
  lastImageHash: string | null;
  // 직전 화면. 이번 화면과 같아야(2회 연속 일치) 확정해서 반영한다.
  previousReading: ScreenReading | null;
  // 포지션별 마지막으로 확정된 시각과 현재가. 종료가격·추가매수가 검증에 쓴다.
  lastConfirmedAt: Map<string, number>;
  lastMarkPrice: Map<string, number>;
}

function log(traderName: string, message: string) {
  console.log(`${new Date().toISOString()} [${traderName}] ${message}`);
}

type Trader = (typeof TRADERS)[number];

async function tick(trader: Trader, state: TraderState) {
  const { traderName, channelId, screenHint } = trader;
  if (Date.now() - state.liveCheckedAt >= LIVE_CHECK_INTERVAL_MS) {
    const videoId = await getLiveVideoId(channelId);
    // 시작 직후 첫 확인과 상태가 바뀔 때만 남겨서, 조용해도 살아 있는지 알 수 있게 한다.
    if (state.liveCheckedAt === 0 || videoId !== state.liveVideoId) {
      log(traderName, videoId ? `방송 중 (영상 ${videoId})` : "방송 꺼져 있음");
    }
    state.liveCheckedAt = Date.now();
    state.liveVideoId = videoId;
  }

  const videoId = state.liveVideoId;
  if (!videoId) {
    // 방송이 꺼져 있으면 마지막으로 확인한 포지션을 유지한다고 본다.
    state.previousReading = null;
    return;
  }

  const image = await fetchLiveThumbnail(videoId);
  if (!image) return;
  const hash = createHash("md5").update(image).digest("hex");
  if (hash === state.lastImageHash) return;
  state.lastImageHash = hash;

  const reading = await readScreen(image, screenHint);
  if (!reading || !reading.isTradingScreen || !reading.positionsPanelVisible) {
    log(traderName, "포지션 화면이 안 보여서 보류");
    state.previousReading = null;
    return;
  }
  if (!reading.positions.every(isConsistent)) {
    log(traderName, `숫자 검산 실패로 이 화면은 버림: ${JSON.stringify(reading.positions)}`);
    state.previousReading = null;
    return;
  }

  const confirmed = state.previousReading !== null && isSameReading(state.previousReading, reading);
  state.previousReading = reading;
  if (!confirmed) {
    log(traderName, `새 화면 읽음, 다음 화면과 일치하면 반영: ${JSON.stringify(reading)}`);
    return;
  }

  const openRows = await getOpenRows(traderName);
  const actions = await planActions(openRows, reading, getPriceRange, (row) =>
    lastConfirmedAtOf(state, row),
  );
  for (const action of actions) {
    await apply(traderName, action, state, { videoId, reading });
  }

  const now = Date.now();
  for (const p of reading.positions) {
    const key = positionKey(p.symbol, p.direction);
    state.lastConfirmedAt.set(key, now);
    const markPrice = p.markPrice ?? (p.positionValue ? p.positionValue / p.size : null);
    if (markPrice !== null) state.lastMarkPrice.set(key, markPrice);
  }
}

// 에이전트를 재시작하면 메모리가 비니, 그때는 행이 처음 등록된 시각부터 본다.
function lastConfirmedAtOf(state: TraderState, row: PositionRow) {
  const key = positionKey(row.symbol ?? "", row.direction);
  return state.lastConfirmedAt.get(key) ?? new Date(row.created_at).getTime();
}

async function apply(
  traderName: string,
  action: Action,
  state: TraderState,
  evidence: { videoId: string; reading: ScreenReading },
) {
  let summary: string;
  if (action.kind === "open") {
    const p = action.position;
    summary = `신규: ${p.symbol} ${p.direction} ${p.size} @ ${p.entryPrice}`;
    if (!DRY_RUN) await openPosition(traderName, p);
  } else if (action.kind === "update") {
    const p = action.position;
    summary = `수정(${action.reason}): ${p.symbol} ${p.direction} ${action.row.quantity} → ${p.size} @ ${p.entryPrice}`;
    if (!DRY_RUN) await updatePosition(action.row, p);
  } else {
    const row = action.row;
    const key = positionKey(row.symbol ?? "", row.direction);
    // 포지션이 사라지면 종료가격도 화면에서 사라져서, 마지막으로 본 현재가로 대신한다.
    const exitPrice = state.lastMarkPrice.get(key) ?? (await getMarkPrice(row.symbol ?? ""));
    if (exitPrice === null) {
      log(traderName, `종료가격을 알 수 없어 종료 보류: ${row.symbol} ${row.direction}`);
      return;
    }
    summary = `종료(${action.note}): ${row.symbol} ${row.direction} @ ${exitPrice}`;
    if (!DRY_RUN) await closePosition(row, exitPrice, action.note);
    state.lastMarkPrice.delete(key);
    state.lastConfirmedAt.delete(key);
  }

  log(traderName, `${DRY_RUN ? "[dry-run] " : ""}${summary}`);
  if (!DRY_RUN) await logAgent("info", `[${traderName}] ${summary}`, evidence);
}

async function runTrader(trader: Trader) {
  const { traderName } = trader;
  const state: TraderState = {
    liveVideoId: null,
    liveCheckedAt: 0,
    lastImageHash: null,
    previousReading: null,
    lastConfirmedAt: new Map(),
    lastMarkPrice: new Map(),
  };
  while (true) {
    try {
      await tick(trader, state);
    } catch (error) {
      log(traderName, `오류: ${String(error)}`);
      if (!DRY_RUN) await logAgent("error", `[${traderName}] ${String(error)}`).catch(() => {});
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

console.log(`포지션 에이전트 시작${DRY_RUN ? " (dry-run: DB에 쓰지 않음)" : ""}`);
// 트레이더마다 따로 돌려서, 한 명의 Gemma 응답(70~90초)이 다른 트레이더를 막지 않게 한다.
await Promise.all(TRADERS.map(runTrader));
