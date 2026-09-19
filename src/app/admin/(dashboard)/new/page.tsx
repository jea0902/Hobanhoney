import Link from "next/link";
import PositionForm from "../PositionForm";
import StatementForm from "../StatementForm";
import { createPosition, createStatement } from "../../actions";

const TABS = [
  { type: "actual", label: "실제 포지션" },
  { type: "statement", label: "예측 발언" },
] as const;

export default function NewPositionPage({ searchParams }: { searchParams: { type?: string } }) {
  const activeType = searchParams.type === "statement" ? "statement" : "actual";

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <h1 className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">새로 추가</h1>

      <div className="mb-4 flex gap-2 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        {TABS.map((tab) => (
          <Link
            key={tab.type}
            href={`/admin/new?type=${tab.type}`}
            className={`flex-1 rounded-md py-1.5 text-center text-sm font-semibold ${
              activeType === tab.type
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {activeType === "actual" ? (
        <PositionForm action={createPosition} submitLabel="추가" showTraderName />
      ) : (
        <StatementForm action={createStatement} submitLabel="추가" showTraderName />
      )}
    </div>
  );
}
