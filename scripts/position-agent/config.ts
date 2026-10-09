// traderName은 positions 테이블의 trader_name과 정확히 같아야 기존 행을 이어받는다.
// screenHint: 칸 이름이 없는 자체 화면은 모델이 칸을 헷갈려서, 칸 순서를 직접 알려준다.
// 트레이더가 방송 화면 배치를 바꾸면 이 설명도 같이 고쳐야 한다.
// traderImage: 새 포지션을 기록할 때 넣을 프로필 사진. null이면 그 트레이더의 이전 행 사진을 이어 쓴다.
// 관리자 화면에서 포지션을 직접 추가하지 않아서, 첫 기록부터 사진이 들어가려면 여기 적어야 한다.
const IMAGE_BASE =
  "https://tahdftbcqkxqkmclwytu.supabase.co/storage/v1/object/public/trader-images";

export const TRADERS = [
  {
    traderName: "박호두",
    channelId: "UC9KQaCA_EMobJUxZszQ4wlg", // @852hodoo
    traderImage: null,
    screenHint:
      "The open position is shown in a custom overlay at the bottom WITHOUT column labels. " +
      "Its row is, from left to right: symbol with a 'Perp' tag and margin mode + leverage below it " +
      "(e.g. 'Cross 13.00x'), size in base coin, position value in USDT, entry price, " +
      "liquidation price, then unrealized PnL in USDT with ROE % and KRW. " +
      "There is NO mark price on this screen, so mark_price must be null.",
  },
  // @zzap9
  {
    traderName: "짭구",
    channelId: "UCAd9A4YzTb-g2BLnaZxhECA",
    traderImage: null,
    screenHint: null,
  },
  // 웨돔의 비트코인. 거래소 기본 포지션 패널(칸 이름 있음)이 라이브 썸네일에 그대로 보여서
  // 화면 설명 없이 읽힌다 (2026-10-09 확인)
  {
    traderName: "웨돔",
    channelId: "UC9stxmmO1eaSTh9F9WETURg",
    traderImage: `${IMAGE_BASE}/wedom.jpg`,
    screenHint: null,
  },
  // @stockking_YN (주식왕용느). 추가 시점(2026-10-09)에 방송 중이 아니라 화면을 확인 못 함.
  // 커스텀 썸네일이면 UNCHANGED_THUMBNAIL_ALERT_MS 알림이 오니, 그때 사또처럼 제외할 것.
  {
    traderName: "용느",
    channelId: "UCbHN1sTuPySKpnqKSp0JHRQ",
    traderImage: `${IMAGE_BASE}/yongnuu.png`,
    screenHint: null,
  },
  // 사또(@live-streamersatto, UCnXe6v0-5vmMMRU2qx0XwUw)는 방송마다 커스텀 썸네일을 걸어서 라이브 썸네일에
  // 실제 화면이 안 나온다 → 자동 추적 불가로 제외 (2026-10-06). 사이트에선 src/lib/traderGroups.ts의
  // UNTRACKED_TRADERS로 "추적 중단" 표시. 새 트레이더도 같은 경우면 UNCHANGED_THUMBNAIL_ALERT_MS 알림으로 드러난다.
  // (라이브 썸네일과 영상 대표 이미지를 비교하는 방법은 안 됨 — 커스텀 썸네일이 없는 라이브도 둘이 똑같다.)
  // 자두두(Jadoodoo, UCIOHzEDwgUuLBZwPKEUt1AQ)도 같은 이유로 제외 (2026-10-09 라이브 썸네일 확인).
  // 자두두 사진: IMAGE_BASE + "/jadoodoo.png" (수동으로 행을 넣을 때 쓸 것)
];

// 방송 중인데 라이브 썸네일이 이만큼 안 바뀌면 실제 화면이 아니라고 보고(커스텀 썸네일·정지 화면)
// 영상마다 한 번 관리자 로그에 알린다. 실제 트레이딩 화면은 5분마다 바뀐다.
export const UNCHANGED_THUMBNAIL_ALERT_MS = 30 * 60_000;

// 라이브 썸네일은 5분마다 새로 찍히지만 언제 바뀔지 모르니 1분마다 확인하고,
// 이미지가 바뀌었을 때만 Gemma를 부른다.
export const POLL_INTERVAL_MS = 60_000;

// 방송 여부는 YouTube Data API 할당량(하루 10,000유닛)을 써서 5분마다만 확인한다.
// 채널당 2유닛 × 하루 288번 ≈ 채널 1개당 580유닛.
export const LIVE_CHECK_INTERVAL_MS = 5 * 60_000;

// 트레이딩 화면은 보이는데 이만큼 연속으로 못 읽으면(썸네일 5분 간격이라 약 30분) 관리자 로그에 알린다.
export const FAILED_READINGS_ALERT = 6;

// 무료 등급 하루 한도가 14,400건이라 채택 (Gemini Flash는 하루 20건).
export const GEMMA_MODEL = "gemma-4-26b-a4b-it";
