// 상위 100개 지갑 계산에서 뺄 주소 (EVM은 소문자). 컨트랙트(DEX 풀·브리지 등)는 코드로 자동으로 빠지므로,
// 여기에는 거래소 핫월렛처럼 "일반 지갑인데 세력 매집이 아닌" 주소를 탐색기에서 확인한 뒤 이유와 함께 추가한다.
// 거래소 지갑은 같은 주소를 여러 EVM 체인(BSC 등)에서 쓰는 경우가 많아서, Etherscan 라벨을 모든 EVM 체인에 적용한다.
export const EXCLUDED_WALLETS = new Set([
  "0x0000000000000000000000000000000000000000", // 발행·소각 (Transfer의 from/to)
  "0x000000000000000000000000000000000000dead", // 소각 주소
  // 2026-10-25 첫 요약에서 여러 종목의 잔고 상위에 반복해서 나온 주소 — Etherscan 공개 라벨로 확인
  "0x28c6c06298d514db089934071355e5743bf21d60", // Binance 14
  "0xdfd5293d8e347dfe59e90efd55b2956a1343963d", // Binance 16
  "0x8894e0a0c962cb723c1976a4421c95949be2d4e3", // Binance 51
  "0x4982085c9e2f89f2ecb8131eca71afad896e89cb", // MEXC 13
  "0x9642b23ed1e01df1092b92641051881a322f5d4e", // MEXC 16
  "0xf89d7b9c864f589bbf53a82105107622b35eaa40", // Bybit: Hot Wallet
  "0x0d0707963952f2fba59dd06f2b425ace40b492fe", // Gate Deposit
  "0x53f78a071d04224b8e254e243fffc6d9f2f3fa23", // KuCoin: Hot Wallet 2
  "0xab782bc7d4a2b306825de5a7730034f8f63ee1bc", // Bitvavo: Hot 3
]);
