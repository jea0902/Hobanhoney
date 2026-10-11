import { ImageResponse } from "next/og";
import { loadKoreanFont } from "@/lib/ogFont";
import { displaySymbol } from "@/lib/symbol";
import { getTraderStats } from "@/lib/traderGroups";
import { getTraderRows, mainOpenPosition } from "@/lib/traderSnapshot";

// 카톡·SNS에 트레이더 페이지 링크를 붙이면 지금 포지션이 미리보기 이미지로 뜬다 — 누르고 싶게 만드는 게 목적.
export const dynamic = "force-dynamic";
// next/og의 Node 버전은 Windows에서 내장 폰트 경로를 잘못 만들어 바로 죽는다(로컬 dev). edge 버전은 파일을 안 읽는다.
export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "코인 유튜버 실시간 포지션";

// 미리보기 하단에 주소를 넣어 사이트 이름이 기억에 남게 한다 (로컬에선 localhost:3000)
const siteHost = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").host;

function formatPrice(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: n >= 1 ? 2 : 6 });
}

export default async function Image({ params }: { params: { name: string } }) {
  const name = decodeURIComponent(params.name);
  const rows = await getTraderRows(name);
  const open = mainOpenPosition(rows);
  const winRate = rows.length > 0 ? getTraderStats(rows, name).winRate : null;

  const isLong = open?.direction === "Long";
  const headline = open
    ? `${displaySymbol(open.symbol!)} ${isLong ? "롱" : "숏"}${open.leverage ? ` ${open.leverage}배` : ""}`
    : "지금은 포지션 없음";
  const details = open
    ? [
        open.entry_price ? `진입가 ${formatPrice(open.entry_price)}` : null,
        open.liquidation_price ? `강제청산가 ${formatPrice(open.liquidation_price)}` : null,
      ]
        .filter(Boolean)
        .join("  ·  ")
    : "다음 진입을 실시간으로 추적 중";
  const footer = `${winRate === null ? "" : `누적 승률 ${winRate.toFixed(0)}%  ·  `}호반꿀 ${siteHost}`;
  // 롱 빨강·숏 파랑은 사이트 전체와 같은 색
  const color = !open ? "#6B7280" : isLong ? "#EF4444" : "#3B82F6";

  const texts = [`${name} 실시간 포지션`, headline, details, footer, "코인 유튜버 포지션 추적"];
  const font = await loadKoreanFont(texts.join(""));

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background: "linear-gradient(135deg, #FFFFFF 0%, #EEF2FF 100%)",
        fontFamily: "NotoSansKR",
      }}
    >
      <div style={{ display: "flex", fontSize: 30, color: "#6366F1" }}>코인 유튜버 포지션 추적</div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 56, color: "#111827" }}>
          {`${name} 실시간 포지션`}
        </div>
        <div style={{ display: "flex", fontSize: 120, color, marginTop: 8 }}>{headline}</div>
        <div style={{ display: "flex", fontSize: 38, color: "#374151", marginTop: 12 }}>
          {details}
        </div>
      </div>
      <div style={{ display: "flex", fontSize: 32, color: "#6B7280" }}>{footer}</div>
    </div>,
    { ...size, fonts: [{ name: "NotoSansKR", data: font, weight: 800 }] },
  );
}
