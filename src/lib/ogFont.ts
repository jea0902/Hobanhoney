// 공유 미리보기 이미지(next/og) 기본 폰트엔 한글이 없어서 Noto Sans KR을 붙인다.
// Google Fonts에 text=를 주면 그 글자만 담은 작은 TTF를 돌려줘서, 이미지에 쓰는 글자만 받는다.
export async function loadKoreanFont(text: string) {
  const css = await (
    await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@800&text=${encodeURIComponent(text)}`,
    )
  ).text();
  const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
  if (!url) throw new Error("Noto Sans KR 폰트 주소를 찾지 못함");
  return (await fetch(url)).arrayBuffer();
}
