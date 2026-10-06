const API = "https://www.googleapis.com/youtube/v3";

// 유튜브 페이지(/@채널/live)는 서버 IP에서 열면 "로그인하여 봇이 아님을 확인하세요"로 막혀서,
// 방송 여부는 공식 YouTube Data API로 확인한다. (호출 1번에 할당량 1유닛, 하루 무료 10,000유닛)
async function callApi(path: string) {
  const res = await fetch(`${API}/${path}&key=${process.env.YOUTUBE_API_KEY}`);
  const json = await res.json();
  if (!res.ok) throw new Error(`YouTube API ${res.status}: ${json?.error?.message}`);
  return json;
}

export async function getLiveVideoId(channelId: string): Promise<string | null> {
  // 채널의 "업로드" 재생목록 ID는 채널 ID 앞의 "UC"를 "UU"로 바꾼 것이다.
  // 방송 중에 클립을 여러 개 올리면 라이브가 최근 5개 밖으로 밀려나서 50개(최대치)까지 본다.
  // playlistItems·videos 둘 다 몇 개를 받든 1유닛이라 할당량은 그대로다.
  const playlist = await callApi(
    `playlistItems?part=contentDetails&maxResults=50&playlistId=UU${channelId.slice(2)}`,
  );
  const videoIds: string[] = playlist.items.map(
    (item: { contentDetails: { videoId: string } }) => item.contentDetails.videoId,
  );
  if (videoIds.length === 0) return null;

  const videos = await callApi(`videos?part=snippet&id=${videoIds.join(",")}`);
  const live = videos.items.find(
    (video: { snippet: { liveBroadcastContent: string } }) =>
      video.snippet.liveBroadcastContent === "live",
  );
  return live?.id ?? null;
}

// 썸네일 이미지 서버(i.ytimg.com)는 서버 IP에서도 막히지 않는다.
export async function fetchLiveThumbnail(videoId: string): Promise<Buffer | null> {
  const res = await fetch(`https://i.ytimg.com/vi/${videoId}/maxresdefault_live.jpg`);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}
