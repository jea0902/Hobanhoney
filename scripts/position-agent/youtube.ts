// 유튜브는 라이브 화면을 주는 공식 API가 없어서, 채널의 /live 페이지로 방송 여부를 보고
// 방송 중에 5분마다 갱신되는 라이브 썸네일을 화면 대신 쓴다.
export async function getLiveVideoId(channelHandle: string): Promise<string | null> {
  const res = await fetch(`https://www.youtube.com/@${channelHandle}/live`, {
    headers: { "Accept-Language": "ko" },
  });
  const html = await res.text();
  if (!html.includes('"isLiveNow":true')) return null;

  const match = html.match(
    /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/,
  );
  return match ? match[1] : null;
}

export async function fetchLiveThumbnail(videoId: string): Promise<Buffer | null> {
  const res = await fetch(`https://i.ytimg.com/vi/${videoId}/maxresdefault_live.jpg`);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}
