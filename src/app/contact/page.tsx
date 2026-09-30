import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";

const CONTACT_EMAIL = "qnf0902@gmail.com";

export const metadata: Metadata = {
  title: "문의 | 호반꿀",
  description: "호반꿀 기록 정정 요청, 제휴, 기타 문의 안내입니다.",
};

export default function ContactPage() {
  return (
    <ContentPage title="문의">
      <p>호반꿀에 대한 문의는 아래 이메일로 보내주세요. 확인하는 대로 답장드리겠습니다.</p>
      <p>
        <strong>이메일:</strong> <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>

      <h2>이런 내용을 보내주세요</h2>
      <ul>
        <li>
          <strong>기록 정정 요청</strong> — 포지션이나 결과가 실제와 다르게 기록된 경우. 트레이더
          이름, 종목, 대략적인 시각을 함께 적어주시면 빠르게 확인할 수 있습니다.
        </li>
        <li>
          <strong>트레이더 추가 제안</strong> — 방송 화면에 포지션을 공개하는 트레이더를
          추천해주세요.
        </li>
        <li>
          <strong>기록 삭제 요청</strong> — 본인의 기록이 사이트에 표시되는 것을 원하지 않는
          트레이더 본인의 요청
        </li>
        <li>
          <strong>제휴 및 기타 문의</strong>
        </li>
      </ul>
    </ContentPage>
  );
}
