import { redirect } from "next/navigation";
import { FOUNDER_TRADER_NAME } from "@/lib/founderTrader";

// 예전 운영자 페이지. 이제 운영자도 다른 트레이더처럼 트레이더 페이지를 쓰고(잔액·월별 성과는 관리자 화면 /admin/account),
// 옛 주소로 들어온 링크가 깨지지 않게 보내 준다.
export default function FounderPage() {
  redirect(`/traders/${encodeURIComponent(FOUNDER_TRADER_NAME)}`);
}
