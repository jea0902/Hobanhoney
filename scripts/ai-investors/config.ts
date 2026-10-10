// 모든 AI는 운영자 추적 시작일(2026-03-06)에 0원으로 시작해 매월 10일 100만원을 입금했다고 가정한다.
export const START = "2026-03-06";
export const DEPOSIT_DAY = 10;
export const DEPOSIT_KRW = 1_000_000;

// 주식 수수료(매수·매도 각각). 실제 증권사보다 넉넉히 잡았다.
export const STOCK_FEE = 0.001;

// 52주 고점·6개월 수익률 계산에 시작일 1년 전부터의 가격이 필요하다.
export const PRICE_HISTORY_FROM = "2025-01-01";
// 공포탐욕기계는 S&P500 사상 최고가 대비 하락폭을 쓰므로 지수만 길게 받는다.
export const SP500_HISTORY_FROM = "1990-01-01";
// 재무는 10년 ROE 계산에 필요한 만큼만 보관한다 (10-K 하나에 3년치가 들어 있음).
export const FUNDAMENTALS_FILED_FROM = "2014-01-01";

export const AI_IDS = [
  "wallstreet",
  "korean_ant",
  "fear_greed",
  "buffett",
  "burry",
  "hobanhoney",
] as const;
export type AiId = (typeof AI_IDS)[number];

// 위키백과 변경 표엔 CIK가 없고, 인수로 상장폐지된 회사는 SEC 티커 목록에서도 빠진다.
// 한 번 ai_universe에 기록되면 이후엔 DB 값을 쓰므로, 이 목록은 처음 기록 전에 빠진 회사만 필요하다.
export const KNOWN_CIKS: Record<string, string> = {
  EA: "0000712515", // 2026-08 인수로 상장폐지 (SEC 목록에서 빠짐)
  AVB: "0000915912", // 2026-08 인수로 상장폐지 (SEC 목록에서 빠짐)
};

// ---- AI 호반꿀 (박호두 반대매매) ----
export const HOBANHONEY_TARGET = "박호두";
// 9/27 이전 박호두 기록은 관리자가 수동으로 넣어서 종료가격이 없다 → 자동 기록(종료가격 있음)부터 따라 한다.
export const HOBANHONEY_FOLLOW_FROM = "2026-09-27";
export const HOBANHONEY_MARGIN_RATIO = 0.1; // 매번 시드의 10%를 증거금으로
export const HOBANHONEY_MAX_LIQUIDATIONS = 2; // 연속 강제청산이 이만큼 되면
export const HOBANHONEY_BAN_DAYS = 7; // 이 기간 매매 금지
// Bybit 테이커 수수료와 BTC 기준 유지증거금률. 펀딩비는 계산하지 않는다.
export const FUTURES_FEE = 0.00055;
export const MAINTENANCE_MARGIN = 0.005;
