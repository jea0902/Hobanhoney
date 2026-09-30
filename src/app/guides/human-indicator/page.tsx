import type { Metadata } from "next";
import Link from "next/link";
import ContentPage from "@/components/ContentPage";

export const metadata: Metadata = {
  title: "인간지표란? | 호반꿀",
  description: "인간지표의 뜻, 호반꿀 승패 기준, 승률 읽을 때 주의할 점.",
};

export default function HumanIndicatorGuide() {
  return (
    <ContentPage title="인간지표란?" updatedAt="2026년 9월 30일">
      <h2>뜻</h2>
      <p>
        &quot;저 사람이 사면 떨어지고 팔면 오른다&quot;는 농담에서 나온 말이야. 매매가 워낙 자주
        틀려서 반대로 하면 맞는다는 뜻으로 써. 반대로 따라 하면 되는 사람은 정지표라고 불러.
      </p>

      <h2>왜 기록으로 봐야 해?</h2>
      <p>
        사람은 크게 물린 장면만 오래 기억해서 체감 승률과 실제 승률이 많이 달라. 그래서 호반꿀은
        포지션을 잡은 순간부터 종료까지 기록하고 결과로 승패를 매겨.
      </p>

      <h2>승패 기준</h2>
      <p>종료 수익률(레버리지 포함) +3% 이상 승, -3% 이하 패, 그 사이는 무승부.</p>

      <h2>승률 볼 때 주의</h2>
      <ul>
        <li>
          <strong>건수부터 봐.</strong> 5건짜리 승률 20%는 우연일 수 있어.
        </li>
        <li>
          <strong>승률 낮아도 돈 벌 수 있어.</strong> 이길 때 크게, 질 때 작게면 수익이야.
        </li>
        <li>
          <strong>롱·숏 비율도 봐.</strong> 롱만 잡는 사람 승률은 그냥 그 기간 장이 올랐는지일 수
          있어.
        </li>
      </ul>

      <h2>그래서 반대로 하면 돼?</h2>
      <p>
        아니. 기록은 방송 화면 기준이라 실제 체결과 차이가 있고, 과거 승률이 앞으로도 이어진다는
        보장도 없어. <Link href="/guides/fear-greed-index">공포탐욕지수</Link> 같은 지표랑 같이
        참고만 해.
      </p>
    </ContentPage>
  );
}
