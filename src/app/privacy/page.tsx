import type { Metadata } from "next";
import Link from "next/link";
import ContentPage from "@/components/ContentPage";

export const metadata: Metadata = {
  title: "개인정보처리방침 | 호반꿀",
  description: "호반꿀이 쓰는 쿠키와 Google 애드센스 광고 안내.",
};

export default function PrivacyPage() {
  return (
    <ContentPage title="개인정보처리방침" updatedAt="2026년 10월 31일">
      <h2>1. 수집하는 정보</h2>
      <p>회원가입이 없으며 개인정보를 입력받지 않음. 자동으로 저장되는 정보는 다음과 같음.</p>
      <ul>
        <li>
          서버 접속 기록 — 호스팅(Vercel)이 보안을 위해 IP, 브라우저, 접속 시각을 처리할 수 있음
        </li>
      </ul>

      <h2>2. Google 애드센스</h2>
      <p>
        Google 애드센스를 통해 광고가 게재될 수 있음. Google 등 광고 사업자는 쿠키를 사용해 이
        사이트와 다른 사이트의 방문 기록을 바탕으로 맞춤 광고를 표시할 수 있음.
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
      <p>브라우저 설정에서 쿠키를 차단하거나 삭제할 수 있음. 차단해도 사이트 이용에는 지장 없음.</p>

      <h2>4. 제3자 제공</h2>
      <p>위 정보는 판매하거나 광고·호스팅 외 목적으로 제3자에게 제공하지 않음.</p>

      <h2>5. 트레이더 기록</h2>
      <p>
        트레이더가 공개 방송에서 보여준 정보를 기록함. 정정이나 삭제는{" "}
        <Link href="/contact">문의</Link>로 요청 바람.
      </p>

      <h2>6. 변경</h2>
      <p>내용이 바뀌면 이 페이지에 수정일과 함께 표시함.</p>
    </ContentPage>
  );
}
