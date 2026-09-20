"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { pingPresence } from "@/lib/presence";

const SESSION_COOKIE = "presence_id";

// localStorage/sessionStorage 대신 쿠키로 세션 ID를 유지 — 새로고침해도 같은 사람으로 잡히게 한다.
function getOrCreateSessionId(): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`));
  if (match) return decodeURIComponent(match[1]);

  const id = crypto.randomUUID();
  document.cookie = `${SESSION_COOKIE}=${id}; path=/; max-age=${60 * 60 * 24}`;
  return id;
}

export default function AutoRefresh({ intervalMs = 10000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const sessionId = getOrCreateSessionId();
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
