/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Next 14 기본값(30초)이면 메뉴로 페이지를 옮길 때 이전에 받은 화면을 재사용해서 포지션이 늦게 반영된다.
    staleTimes: { dynamic: 0 },
  },
};

export default nextConfig;
