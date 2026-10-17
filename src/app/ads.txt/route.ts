// 애드센스가 "이 사이트 광고는 이 게시자 계정이 판다"를 확인하는 파일. 게시자 ID는 layout.tsx의 애드센스 스크립트와 같은 값.
export function GET() {
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  if (!clientId) return new Response("Not Found", { status: 404 });

  // 스크립트에는 "ca-pub-…"로 넣지만 ads.txt에는 "pub-…"만 쓴다. 끝의 값은 구글 고정 인증 ID.
  const publisherId = clientId.replace(/^ca-/, "");
  return new Response(`google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
