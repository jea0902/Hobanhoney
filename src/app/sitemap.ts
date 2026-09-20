import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: "always", priority: 1 },
    { url: `${siteUrl}/rankers`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${siteUrl}/founder`, changeFrequency: "hourly", priority: 0.8 },
  ];
}
