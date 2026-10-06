// 실행: npm run agent            (DB에 반영)
//       npm run agent -- --dry-run (DB에 쓰지 않고 판단 결과만 출력)
import { createHash } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import type { PositionRow } from "../../src/types/position.ts";
import {
  FAILED_READINGS_ALERT,
  LIVE_CHECK_INTERVAL_MS,
  POLL_INTERVAL_MS,
  TRADERS,
  UNCHANGED_THUMBNAIL_ALERT_MS,
} from "./config.ts";
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
  lastImageChangedAt: number;
  // "썸네일이 안 바뀜" 경고를 이미 남긴 영상. 같은 영상에서 반복해서 남기지 않으려고 기억한다.
  unchangedAlertVideoId: string | null;
  failedReadings: number;
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

// reading이 null(못 읽음)이 아니고, 포지션 화면이 보이고, 숫자 검산까지 통과해야 쓸 수 있다.
function isUsable(reading: ScreenReading | null): reading is ScreenReading {
  return (
    reading !== null &&
    reading.isTradingScreen &&
    reading.positionsPanelVisible &&
    reading.positions.every(isConsistent)
  );
}

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
  if (hash === state.lastImageHash) {
    // 실제 트레이딩 화면은 차트·가격·시계가 움직여서 썸네일이 5분마다 바뀐다. 방송 중인데 오래 그대로면
    // 커스텀 썸네일(사또 사례)이거나 정지 화면이라 포지션을 볼 수 없다. 이 경우는 Gemma를 안 불러서
    // 아무 로그도 안 남으니, 영상마다 한 번 관리자 로그에 알린다.
    if (
      Date.now() - state.lastImageChangedAt >= UNCHANGED_THUMBNAIL_ALERT_MS &&
      state.unchangedAlertVideoId !== videoId
    ) {
      state.unchangedAlertVideoId = videoId;
      const minutes = Math.round(UNCHANGED_THUMBNAIL_ALERT_MS / 60_000);
      log(traderName, `방송 중인데 썸네일이 ${minutes}분 넘게 그대로 (영상 ${videoId})`);
      if (!DRY_RUN) {
        await logAgent(
          "error",
          `[${traderName}] 방송 중인데 라이브 썸네일이 ${minutes}분 넘게 안 바뀜 — ` +
            "커스텀 썸네일이면 실제 화면을 볼 수 없어 자동 추적 불가",
          { videoId },
        );
      }
    }
    return;
  }
  state.lastImageHash = hash;
  state.lastImageChangedAt = Date.now();

  let reading = await readScreen(image, screenHint);
  // 방송 화면 배치가 바뀌면 화면 설명이 오히려 틀린 안내가 되므로, 설명 없이 한 번 더 읽어 본다.
  if (screenHint && !isUsable(reading)) {
    const retry = await readScreen(image, null);
    if (isUsable(retry)) {
      log(traderName, "화면 설명 없이 읽은 결과를 사용 (방송 화면 배치가 바뀌었을 수 있음)");
      reading = retry;
    }
  }

  if (reading && (!reading.isTradingScreen || !reading.positionsPanelVisible)) {
    log(traderName, "포지션 화면이 안 보여서 보류");
    state.previousReading = null;
    state.failedReadings = 0;
    return;
  }
  if (!isUsable(reading)) {
    state.failedReadings++;
    log(
      traderName,
      `화면을 못 읽었거나 숫자 검산 실패로 버림 (${state.failedReadings}회 연속): ${JSON.stringify(reading)}`,
    );
    state.previousReading = null;
    // 조용히 반영이 멈추지 않도록, 연속 실패가 기준에 닿는 순간 한 번만 관리자 로그에 남긴다.
    if (state.failedReadings === FAILED_READINGS_ALERT && !DRY_RUN) {
      await logAgent(
        "error",
        `[${traderName}] 트레이딩 화면은 보이는데 ${FAILED_READINGS_ALERT}회 연속 포지션을 못 읽음 — ` +
          "방송 화면 배치가 바뀌었으면 config.ts의 screenHint를 고쳐 주세요 (Gemma 장애일 수도 있음)",
        { videoId, reading },
      );
    }
    return;
  }
  state.failedReadings = 0;

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
    lastImageChangedAt: Date.now(),
    unchangedAlertVideoId: null,
    failedReadings: 0,
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
