import { setTimeout as sleep } from "node:timers/promises";
import type { Direction } from "../../src/types/position.ts";
import { GEMMA_MODEL } from "./config.ts";

export interface ScreenPosition {
  symbol: string; // "BTCUSDT"처럼 슬래시 없는 형태
  direction: Direction;
  leverage: number | null;
  size: number;
  entryPrice: number;
  markPrice: number | null;
  liqPrice: number | null;
  positionValue: number | null;
  unrealizedPnl: number | null;
}

export interface ScreenReading {
  isTradingScreen: boolean;
  positionsPanelVisible: boolean;
  // "Positions (1)"처럼 개수 표시가 화면에 있을 때만 숫자, 없으면 null
  positionsCount: number | null;
  positions: ScreenPosition[];
}

const PROMPT = `This is a screenshot of a crypto trader's live stream.
Reply ONLY with JSON in this shape:
{"is_trading_screen":true,"positions_panel_visible":true,"positions_count":null,"positions":[{"symbol":"","direction":"","leverage":null,"size":null,"entry_price":null,"mark_price":null,"liq_price":null,"position_value":null,"unrealized_pnl":null}]}
Rules:
- is_trading_screen: true only if an exchange trading screen is shown (not a game, camera, or poster image).
- positions_panel_visible: true only if the list of open futures positions (or an overlay showing the open position) is visible and readable.
- positions_count: the number in a label like "Positions (N)" if shown, otherwise null.
- positions: every visible open position row. Empty array if the panel shows no positions.
- symbol: like "BTCUSDT" without spaces or suffixes.
- direction: "Long" or "Short". If not labeled, infer it from liquidation price vs entry price and the sign of unrealized PnL.
- size: the position quantity in the base coin (not USDT).
- mark_price: only if a column is explicitly labeled like "Mark price". Otherwise null (do not reuse another number).
- liq_price: the liquidation price. On unlabeled overlays it is the price-like number on the losing side of the entry price (below entry for Long, above entry for Short).
- position_value: the position size in USDT, if shown.
- All numbers as plain numbers without commas or units. Use null for anything not visible or covered by an overlay.`;

// 503(수요 폭증)과 500(구글 내부 오류)은 잠시 뒤 다시 보내면 대부분 풀린다.
const RETRY_STATUSES = [429, 500, 503];

export async function readScreen(
  image: Buffer,
  screenHint: string | null,
): Promise<ScreenReading | null> {
  const prompt = screenHint ? `${PROMPT}\nAbout this streamer's screen: ${screenHint}` : PROMPT;
  const body = JSON.stringify({
    contents: [
      {
        parts: [
          { text: prompt },
          { inline_data: { mime_type: "image/jpeg", data: image.toString("base64") } },
        ],
      },
    ],
  });

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMMA_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY!,
        },
        body,
        // Gemma는 한 번에 70~90초 걸린다.
        signal: AbortSignal.timeout(180_000),
      },
    );

    if (res.ok) return parseReading(await res.json());
    if (!RETRY_STATUSES.includes(res.status)) {
      throw new Error(`Gemma ${res.status}: ${await res.text()}`);
    }
    await sleep(15_000);
  }
  return null;
}

function parseReading(json: unknown): ScreenReading | null {
  // Gemma는 생각 과정(thought)을 별도 part로 섞어 보낼 수 있어서 답변 part만 모은다.
  const parts: { text?: string; thought?: boolean }[] =
    (json as { candidates?: { content?: { parts?: [] } }[] })?.candidates?.[0]?.content?.parts ??
    [];
  const text = parts
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("");

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return null;

  let raw;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }

  const positions: ScreenPosition[] = [];
  for (const p of raw.positions ?? []) {
    const direction = toDirection(p.direction);
    const size = toNumber(p.size);
    const entryPrice = toNumber(p.entry_price);
    // 핵심 값이 하나라도 안 읽히면 이 화면 전체를 믿지 않는다 (호출한 쪽에서 보류 처리).
    if (!p.symbol || !direction || !size || !entryPrice) return null;
    positions.push({
      symbol: String(p.symbol)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .replace(/PERP$/, ""),
      direction,
      leverage: toNumber(p.leverage),
      size,
      entryPrice,
      markPrice: toNumber(p.mark_price),
      liqPrice: toNumber(p.liq_price),
      positionValue: toNumber(p.position_value),
      unrealizedPnl: toNumber(p.unrealized_pnl),
    });
  }

  return {
    isTradingScreen: raw.is_trading_screen === true,
    positionsPanelVisible: raw.positions_panel_visible === true,
    positionsCount: toNumber(raw.positions_count),
    positions,
  };
}

function toDirection(value: unknown): Direction | null {
  const text = String(value ?? "").toLowerCase();
  if (text === "long") return "Long";
  if (text === "short") return "Short";
  return null;
}

// 모델이 "221,196 GRAM"처럼 쉼표나 단위를 붙여 답할 때가 있다.
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && String(value).trim() !== "" ? n : null;
}
