"use client";

import { useEffect, useState } from "react";

const WS_URL = "wss://stream.bybit.com/v5/public/linear";
const SYMBOL = "BTCUSDT";

interface Ticker {
  lastPrice: number;
  change24hPercent: number;
}

// 페이지 전체를 10초마다 새로고침하는 것과 별개로, 가격만은 Bybit 공개 WebSocket으로 체결될 때마다 받는다.
export default function BtcLivePrice() {
  const [ticker, setTicker] = useState<Ticker | null>(null);

  useEffect(() => {
    let ws: WebSocket;
    let pingTimer: ReturnType<typeof setInterval>;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let closedByUs = false;

    function connect() {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => {
        ws.send(JSON.stringify({ op: "subscribe", args: [`tickers.${SYMBOL}`] }));
        // Bybit은 20초마다 ping이 없으면 연결을 끊는다.
        pingTimer = setInterval(() => ws.send(JSON.stringify({ op: "ping" })), 20_000);
      };
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        const data = message?.data;
        if (!data) return;
        // 처음 한 번은 전체 값(snapshot)이, 이후엔 바뀐 칸만(delta) 와서 이전 값에 합친다.
        setTicker((previous) => ({
          lastPrice: data.lastPrice ? Number(data.lastPrice) : (previous?.lastPrice ?? 0),
          change24hPercent: data.price24hPcnt
            ? Number(data.price24hPcnt) * 100
            : (previous?.change24hPercent ?? 0),
        }));
      };
      ws.onclose = () => {
        clearInterval(pingTimer);
        if (!closedByUs) reconnectTimer = setTimeout(connect, 3_000);
      };
    }

    connect();
    return () => {
      closedByUs = true;
      clearInterval(pingTimer);
      clearTimeout(reconnectTimer);
      ws.close();
    };
  }, []);

  const up = (ticker?.change24hPercent ?? 0) >= 0;

  const price = ticker
    ? `$${ticker.lastPrice.toLocaleString("en-US", { minimumFractionDigits: 1 })}`
    : "—";
  const change = ticker
    ? `${up ? "+" : ""}${ticker.change24hPercent.toFixed(2)}% (24h)`
    : "연결 중…";
  const changeColor = up ? "text-red-500" : "text-blue-500";

  return (
    <div className="flex items-center gap-x-2 text-xs sm:text-sm">
      <span className="flex items-center gap-1 font-semibold text-gray-500 dark:text-gray-400">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 motion-safe:animate-pulse" />
        Bybit BTC 무기한
      </span>
      <span className="text-base font-extrabold tabular-nums text-gray-900 dark:text-gray-100 sm:text-lg">
        {price}
      </span>
      <span className={`font-bold tabular-nums ${changeColor}`}>{change}</span>
    </div>
  );
}
