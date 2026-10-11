import { ImageResponse } from "next/og";
import { AI_TRADERS, getAiSummaries, totalReturnPercent } from "@/lib/aiInvestors";
import { loadKoreanFont } from "@/lib/ogFont";

// 카톡·SNS에 AI 페이지 링크를 붙이면 지금 수익률이 미리보기 이미지로 뜬다 (트레이더 페이지 미리보기와 같은 틀).
export const dynamic = "force-dynamic";
// next/og의 Node 버전은 Windows에서 내장 폰트 경로를 잘못 만들어 바로 죽는다(로컬 dev). edge 버전은 파일을 안 읽는다.
export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "AI 트레이더 수익률";

const siteHost = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").host;

function formatUsd(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export default async function Image({ params }: { params: { id: string } }) {
  const meta = AI_TRADERS.find((ai) => ai.id === params.id) ?? AI_TRADERS[0];
  const latest = (await getAiSummaries()).find((s) => s.meta.id === meta.id)?.latest ?? null;

  const rate = latest ? totalReturnPercent(latest) : null;
  const headline =
    rate === null ? "계산 중" : `누적 수익률 ${rate > 0 ? "+" : ""}${rate.toFixed(1)}%`;
  const details = latest
    ? `총자산 ${formatUsd(latest.equity)}  ·  누적 입금 ${formatUsd(latest.invested)}`
    : "매일 오전 7시 30분 업데이트";
  const footer = `${meta.summary}  ·  호반꿀 ${siteHost}`;
  // 수익 빨강·손실 파랑은 사이트 전체와 같은 색
  const color = rate === null ? "#6B7280" : rate >= 0 ? "#EF4444" : "#3B82F6";

  const font = await loadKoreanFont(["AI 트레이더", meta.name, headline, details, footer].join(""));

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
      <div style={{ display: "flex", fontSize: 30, color: "#6366F1" }}>AI 트레이더</div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 64, color: "#111827" }}>{meta.name}</div>
        <div style={{ display: "flex", fontSize: 100, color, marginTop: 8 }}>{headline}</div>
        <div style={{ display: "flex", fontSize: 38, color: "#374151", marginTop: 12 }}>
          {details}
        </div>
      </div>
      <div style={{ display: "flex", fontSize: 30, color: "#6B7280" }}>{footer}</div>
    </div>,
    { ...size, fonts: [{ name: "NotoSansKR", data: font, weight: 800 }] },
  );
}
