interface StatementFormValues {
  trader_image: string;
  quote: string;
  direction: "Long" | "Short";
  result: "" | "win" | "draw" | "loss";
  result_note: string;
}

export default function StatementForm({
  action,
  defaultValues,
  submitLabel,
  showTraderName = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaultValues?: Partial<StatementFormValues>;
  submitLabel: string;
  showTraderName?: boolean;
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      {showTraderName && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            트레이더 이름
          </span>
          <input
            type="text"
            name="trader_name"
            placeholder="전인구경제연구소"
            required
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-gray-500"
          />
        </label>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">발언 내용</span>
        <textarea
          name="quote"
          placeholder="지금 금리가 너무 올라서 주식들이 위험할 수 있다"
          required
          rows={3}
          defaultValue={defaultValues?.quote ?? ""}
          className="resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-gray-500"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">예상 방향</span>
        <select
          name="direction"
          defaultValue={defaultValues?.direction ?? "Long"}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-gray-500"
        >
          <option value="Long">상승 (Long)</option>
          <option value="Short">하락 (Short)</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          사진 URL (선택)
        </span>
        <input
          type="text"
          name="trader_image"
          placeholder="https://..."
          defaultValue={defaultValues?.trader_image ?? ""}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-gray-500"
        />
      </label>

      <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">결과</span>
          <select
            name="result"
            defaultValue={defaultValues?.result ?? ""}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-gray-500"
          >
            <option value="">미기록</option>
            <option value="win">승리</option>
            <option value="draw">무승부</option>
            <option value="loss">패배</option>
          </select>
        </label>

        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            결과 메모 (선택 — 발언 이후 며칠간 실제로 어떻게 됐는지)
          </span>
          <textarea
            name="result_note"
            rows={2}
            placeholder="예: 발언 후 3일간 코스피 -3.2%, 예측 적중"
            defaultValue={defaultValues?.result_note ?? ""}
            className="resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-gray-500"
          />
        </label>
      </div>

      <button
        type="submit"
        className="rounded-lg bg-[#3182F6] px-4 py-2 text-sm font-semibold text-white"
      >
        {submitLabel}
      </button>
    </form>
  );
}
