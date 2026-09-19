"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { pingPresence } from "@/lib/presence";

export default function AutoRefresh({ intervalMs = 10000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    // 새로고침 없이 매번 새 세션으로 취급 — "지금 접속 중"만 세면 되므로 영구 저장은 불필요.
    const sessionId = crypto.randomUUID();
    const ping = () => pingPresence(sessionId);

    ping();
    const id = setInterval(() => {
      router.refresh();
      ping();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
