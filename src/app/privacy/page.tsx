import type { Metadata } from "next";
import Link from "next/link";
import ContentPage from "@/components/ContentPage";

export const metadata: Metadata = {
  title: "개인정보처리방침 | 호반꿀",
  description: "호반꿀이 쓰는 쿠키와 Google 애드센스 광고 안내.",
};

export default function PrivacyPage() {
  return (
    <ContentPage title="개인정보처리방침" updatedAt="2026년 9월 30일">
      <h2>1. 수집하는 정보</h2>
      <p>회원가입이 없고 개인정보를 입력받지 않아. 자동으로 저장되는 건 이것뿐이야.</p>
      <ul>
        <li>presence_id 쿠키 — 접속자 수 집계용 임의 식별값, 24시간 뒤 만료</li>
        <li>theme 쿠키 — 다크/라이트 모드 설정</li>
        <li>
          서버 접속 기록 — 호스팅(Vercel)이 보안을 위해 IP, 브라우저, 접속 시각을 처리할 수 있음
        </li>
      </ul>

      <h2>2. Google 애드센스</h2>
      <p>
        Google 애드센스로 광고가 나갈 수 있어. Google 같은 광고 사업자는 쿠키로 이 사이트와 다른
        사이트 방문 기록을 바탕으로 맞춤 광고를 보여줄 수 있어.
      </p>
      <ul>
        <li>
          맞춤 광고 끄기:{" "}
          <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">
            Google 광고 설정
          </a>
        </li>
        <li>
          자세한 내용:{" "}
          <a
            href="https://policies.google.com/technologies/partner-sites"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google 파트너 사이트 데이터 사용 정책
          </a>
        </li>
      </ul>

      <h2>3. 쿠키 거부</h2>
      <p>브라우저 설정에서 쿠키를 막거나 지울 수 있어. 막아도 사이트는 그대로 볼 수 있어.</p>

      <h2>4. 제3자 제공</h2>
      <p>위 정보는 팔거나 광고·호스팅 외 목적으로 넘기지 않아.</p>

      <h2>5. 트레이더 기록</h2>
      <p>
        트레이더가 공개 방송에서 보여준 정보를 기록해. 정정이나 삭제는{" "}
        <Link href="/contact">문의</Link>로 요청해줘.
      </p>

      <h2>6. 변경</h2>
      <p>바뀌면 이 페이지에 수정일과 함께 표시할게.</p>
    </ContentPage>
  );
}
