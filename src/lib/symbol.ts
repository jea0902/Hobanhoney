// 화면 표시용: "BTC/USDT"(유튜버 기록)와 "BTCUSDT"(운영자 Bybit 계정)를 둘 다 "BTC"로 통일.
// 좁은 화면에서 표 가로 스크롤 버튼이 옆 칸을 가려서 뒷부분을 뗀다. DB 값은 시세 조회에 필요해서 그대로 둔다.
export function displaySymbol(symbol: string) {
  return symbol.replace(/\/?USDT$/i, "");
}
