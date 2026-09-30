import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";

const CONTACT_EMAIL = "qnf0902@gmail.com";

export const metadata: Metadata = {
  title: "문의 | 호반꿀",
  description: "호반꿀 기록 정정, 트레이더 추가 제안, 제휴 문의.",
};

export default function ContactPage() {
  return (
    <ContentPage title="문의">
      <p>
        <strong>이메일:</strong> <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
      <ul>
        <li>기록 정정 — 트레이더 이름, 종목, 대략적인 시각 같이 적어줘</li>
        <li>트레이더 추가 제안</li>
        <li>기록 삭제 요청 (트레이더 본인)</li>
        <li>제휴·기타</li>
      </ul>
    </ContentPage>
  );
}
