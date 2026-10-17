// 방송 화면이 아니라 하이퍼리퀴드 지갑 주소로 포지션을 추적하는 트레이더.
// 사이트(src/lib/walletTraders.ts)와 기록 수집 스크립트(scripts/wallet-traders)가 같이 쓰므로 다른 파일을 import하지 않는다.
const IMAGE_BASE =
  "https://tahdftbcqkxqkmclwytu.supabase.co/storage/v1/object/public/trader-images";

export const WALLET_TRADERS = [
  // 대만 가수 출신 코인 트레이더 (2026-10-17 추가)
  {
    name: "제프리황",
    address: "0x020ca66c30bec2c4fe3861a94e4db4a498a35872",
    image: `${IMAGE_BASE}/Jeffrey_Huang.jpg`,
  },
];
