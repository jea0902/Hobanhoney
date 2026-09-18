import PositionGrid from "./PositionGrid";

export default function PositionsSection() {
  return (
    <section className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          실시간 포지션
          <span className="text-gray-300">→</span>
        </h2>

        <PositionGrid />
      </div>
    </section>
  );
}
