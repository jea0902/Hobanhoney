import type { MetadataRoute } from "next";
import { getSupabase } from "@/lib/supabase";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// 트레이더 페이지 목록이 DB에서 나오므로, 빌드 시점이 아니라 요청마다 만든다(새 트레이더가 바로 포함되게).
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data } = await getSupabase().from("positions").select("trader_name");
  const traderNames = [...new Set((data ?? []).map((row) => row.trader_name as string))];

  return [
    { url: siteUrl, changeFrequency: "always", priority: 1 },
    { url: `${siteUrl}/rankers`, changeFrequency: "hourly", priority: 0.8 },
    ...traderNames.map((name) => ({
      url: `${siteUrl}/traders/${encodeURIComponent(name)}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    { url: `${siteUrl}/guides`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${siteUrl}/guides/human-indicator`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/guides/liquidation-price`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/guides/fear-greed-index`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/contact`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
