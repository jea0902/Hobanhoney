// traderName은 positions 테이블의 trader_name과 정확히 같아야 기존 행을 이어받는다.
// screenHint: 칸 이름이 없는 자체 화면은 모델이 칸을 헷갈려서, 칸 순서를 직접 알려준다.
// 트레이더가 방송 화면 배치를 바꾸면 이 설명도 같이 고쳐야 한다.
export const TRADERS = [
  {
    traderName: "박호두",
    channelHandle: "852hodoo",
    screenHint:
      "The open position is shown in a custom overlay at the bottom WITHOUT column labels. " +
      "Its row is, from left to right: symbol with a 'Perp' tag and margin mode + leverage below it " +
      "(e.g. 'Cross 13.00x'), size in base coin, position value in USDT, entry price, " +
      "liquidation price, then unrealized PnL in USDT with ROE % and KRW. " +
      "There is NO mark price on this screen, so mark_price must be null.",
  },
  { traderName: "짭구", channelHandle: "zzap9", screenHint: null },
  { traderName: "사또", channelHandle: "live-streamersatto", screenHint: null },
];

// 라이브 썸네일은 5분마다 새로 찍히지만 언제 바뀔지 모르니 1분마다 확인하고,
// 이미지가 바뀌었을 때만 Gemma를 부른다.
export const POLL_INTERVAL_MS = 60_000;

// 무료 등급 하루 한도가 14,400건이라 채택 (Gemini Flash는 하루 20건).
export const GEMMA_MODEL = "gemma-4-26b-a4b-it";
