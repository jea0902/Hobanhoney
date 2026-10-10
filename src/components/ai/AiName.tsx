// AI 트레이더는 프로필 사진 없이 이름으로 구분한다. "AI"만 색을 넣고 나머지 이름을 굵게 강조.
export default function AiName({ name, className = "" }: { name: string; className?: string }) {
  const rest = name.replace(/^AI\s*/, "");
  return (
    <span className={`font-black tracking-tight text-gray-900 dark:text-gray-100 ${className}`}>
      <span className="text-indigo-500">AI</span> {rest}
    </span>
  );
}
