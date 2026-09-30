import type { Metadata } from "next";
import Link from "next/link";
import ContentPage from "@/components/ContentPage";

export const metadata: Metadata = {
  title: "개인정보처리방침 | 호반꿀",
  description: "호반꿀이 수집하는 정보, 쿠키 사용, Google 애드센스 광고에 관한 안내입니다.",
};

export default function PrivacyPage() {
  return (
    <ContentPage title="개인정보처리방침" updatedAt="2026년 9월 30일">
      <p>
        호반꿀(이하 &quot;사이트&quot;)은 방문자의 개인정보를 소중히 여기며, 사이트 이용 과정에서
        어떤 정보가 어떻게 쓰이는지 아래와 같이 안내합니다.
      </p>

      <h2>1. 수집하는 정보</h2>
      <p>
        사이트는 회원가입 기능이 없으며, 이름·연락처 같은 개인정보를 직접 입력받지 않습니다. 사이트
        이용 중에는 아래 정보만 자동으로 저장되거나 처리됩니다.
      </p>
      <ul>
        <li>
          <strong>접속자 수 집계용 쿠키 (presence_id)</strong> — &quot;현재 접속 중&quot; 인원을
          세기 위해 임의로 만든 식별값입니다. 개인을 특정할 수 없고 24시간 뒤 만료됩니다.
        </li>
        <li>
          <strong>화면 테마 쿠키 (theme)</strong> — 다크 모드/라이트 모드 선택을 기억합니다.
        </li>
        <li>
          <strong>서버 접속 기록</strong> — 사이트를 호스팅하는 Vercel이 보안과 장애 대응을 위해 IP
          주소, 브라우저 종류, 접속 시각 같은 기본 접속 기록을 처리할 수 있습니다.
        </li>
      </ul>

      <h2>2. Google 애드센스 광고와 쿠키</h2>
      <p>
        사이트는 Google 애드센스를 통해 광고를 게재할 수 있습니다. 이 경우 Google을 포함한 제3자
        광고 사업자는 쿠키를 사용해서 방문자가 이 사이트나 다른 웹사이트를 방문한 기록을 바탕으로
        광고를 게재할 수 있습니다.
      </p>
      <ul>
        <li>
          Google은 광고 쿠키를 사용해 방문자의 이 사이트 및 다른 사이트 방문 기록을 기반으로 맞춤
          광고를 게재합니다.
        </li>
        <li>
          방문자는{" "}
          <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">
            Google 광고 설정
          </a>
          에서 맞춤 광고를 끌 수 있습니다.
        </li>
        <li>
          Google이 광고에서 데이터를 사용하는 방식은{" "}
          <a
            href="https://policies.google.com/technologies/partner-sites"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google 파트너 사이트 데이터 사용 정책
          </a>
          에서 확인할 수 있습니다.
        </li>
      </ul>

      <h2>3. 쿠키를 거부하는 방법</h2>
      <p>
        브라우저 설정에서 쿠키 저장을 거부하거나 삭제할 수 있습니다. 쿠키를 거부해도 사이트의 주요
        정보는 그대로 볼 수 있지만, 테마 설정이 기억되지 않거나 접속자 수에 포함되지 않을 수
        있습니다.
      </p>

      <h2>4. 정보의 보관과 제3자 제공</h2>
      <p>
        사이트는 위 정보를 판매하거나 광고·호스팅 외의 목적으로 제3자에게 제공하지 않습니다. 접속자
        수 집계용 식별값은 집계에만 쓰이고 개인을 식별하는 데 사용하지 않습니다.
      </p>

      <h2>5. 사이트에 표시되는 트레이더 정보</h2>
      <p>
        사이트에 기록되는 유튜버 트레이더의 포지션은 트레이더가 공개 방송에서 직접 보여준 정보를
        바탕으로 합니다. 기록에 대한 정정이나 삭제를 원하시면 아래 문의처로 연락해 주세요.
      </p>

      <h2>6. 문의</h2>
      <p>
        개인정보 처리에 관한 문의는 <Link href="/contact">문의 페이지</Link>의 이메일로 보내주세요.
      </p>

      <h2>7. 방침 변경</h2>
      <p>이 방침이 바뀌면 이 페이지에 변경 내용과 수정일을 표시합니다.</p>
    </ContentPage>
  );
}
