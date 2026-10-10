import type { Metadata } from "next";
import Link from "next/link";
import ContentPage from "@/components/ContentPage";

export const metadata: Metadata = {
  title: "사이트 소개 | 호반꿀",
  description: "유튜버 트레이더들의 실제 포지션과 승률을 기록하는 인간지표 대시보드.",
};

export default function AboutPage() {
  return (
    <ContentPage title="호반꿀 소개">
      <p>
        유튜버 트레이더들이 방송에서 잡은 실제 포지션을 기록하고, 트레이더별 승률과 성향을 보여주는
        사이트임. &quot;인간지표&quot;가 사실인지 감이 아닌 기록으로 확인하기 위해 만들었음.
      </p>

      <h2>메뉴</h2>
      <ul>
        <li>
          <Link href="/">홈</Link> — 유튜버 트레이더 실시간 포지션, 승률, 주요 투자 지표
        </li>
        <li>
          <Link href="/rankers">랭커</Link> — Hyperliquid 수익 상위 고래들의 실시간 포지션
        </li>
        <li>
          <Link href="/ai">AI</Link> — 정해진 전략대로만 매매하는 AI 트레이더들의 포지션과 성과
        </li>
      </ul>

      <h2>데이터 출처</h2>
      <ul>
        <li>유튜버 포지션: AI가 라이브 방송 화면을 읽어 자동 기록 (몇 분 늦을 수 있음)</li>
        <li>랭커 포지션: Hyperliquid 공개 API</li>
        <li>운영자 포지션: Bybit 읽기 전용 API</li>
        <li>AI 트레이더: Yahoo Finance 시세, SEC EDGAR 재무, 위키백과 S&amp;P500 구성 종목</li>
        <li>시세·지표: Bybit, 빗썸, 네이버 증권, alternative.me, FRED, Yahoo Finance</li>
      </ul>

      <h2>승패 기준</h2>
      <p>
        종료 수익률(레버리지 포함) +3% 이상은 승, -3% 이하는 패, 그 사이는 무승부. 운영자 포지션은
        실현손익 ÷ 증거금 기준으로 같은 방식 적용.
      </p>

      <h2>유의 사항</h2>
      <p>
        투자 권유가 아님. 기록은 실제와 다를 수 있으며, 투자 책임은 본인에게 있음. 잘못된 기록은{" "}
        <Link href="/contact">문의</Link>로 알려주시기 바람.
      </p>
    </ContentPage>
  );
}
