interface PositionFormValues {
  trader_image: string;
  symbol: string;
  direction: "Long" | "Short";
  leverage: string;
  quantity: string;
  entry_price: string;
  liquidation_price: string;
  result: "" | "win" | "draw" | "loss";
  result_note: string;
}

const INPUT_CLASS =
  "rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-gray-500";
const LABEL_CLASS = "text-xs font-medium text-gray-500 dark:text-gray-400";

const FIELDS: {
  name: keyof Omit<PositionFormValues, "direction" | "result">;
  label: string;
  placeholder: string;
  required: boolean;
  type: "text" | "number";
}[] = [
  { name: "symbol", label: "종목", placeholder: "BTCUSDT", required: true, type: "text" },
  { name: "leverage", label: "레버리지 (배)", placeholder: "10", required: true, type: "number" },
  { name: "quantity", label: "수량", placeholder: "0.5", required: true, type: "number" },
  {
    name: "entry_price",
    label: "진입가",
    placeholder: "77625.70",
    required: true,
    type: "number",
  },
  {
    name: "liquidation_price",
    label: "청산가",
    placeholder: "81117.90",
    required: true,
    type: "number",
  },
  {
    name: "trader_image",
    label: "사진 URL (선택)",
    placeholder: "https://...",
    required: false,
    type: "text",
  },
];

export default function PositionForm({
  action,
  defaultValues,
  submitLabel,
  showTraderName = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaultValues?: Partial<PositionFormValues>;
  submitLabel: string;
  showTraderName?: boolean;
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      {showTraderName && (
        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>트레이더 이름</span>
          <input
            type="text"
            name="trader_name"
            placeholder="트레이더 A"
            required
            className={INPUT_CLASS}
          />
        </label>
      )}

      {FIELDS.map((field) => (
        <label key={field.name} className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>{field.label}</span>
          <input
            type={field.type}
            step={field.type === "number" ? "any" : undefined}
            inputMode={field.type === "number" ? "decimal" : undefined}
            name={field.name}
            placeholder={field.placeholder}
            defaultValue={defaultValues?.[field.name] ?? ""}
            required={field.required}
            className={INPUT_CLASS}
          />
        </label>
      ))}

      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS}>방향</span>
        <select
          name="direction"
          defaultValue={defaultValues?.direction ?? "Long"}
          className={INPUT_CLASS}
        >
          <option value="Long">Long</option>
          <option value="Short">Short</option>
        </select>
      </label>

      <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>결과</span>
          <select name="result" defaultValue={defaultValues?.result ?? ""} className={INPUT_CLASS}>
            <option value="">미청산</option>
            <option value="win">승리</option>
            <option value="draw">무승부</option>
            <option value="loss">패배</option>
          </select>
        </label>

        <label className="mt-3 flex flex-col gap-1">
          <span className={LABEL_CLASS}>결과 메모 (선택)</span>
          <textarea
            name="result_note"
            rows={2}
            defaultValue={defaultValues?.result_note ?? ""}
            className={`resize-none ${INPUT_CLASS}`}
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
