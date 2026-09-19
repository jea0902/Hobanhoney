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
          <span className="text-xs font-medium text-gray-500">트레이더 이름</span>
          <input
            type="text"
            name="trader_name"
            placeholder="트레이더 A"
            required
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
          />
        </label>
      )}

      {FIELDS.map((field) => (
        <label key={field.name} className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">{field.label}</span>
          <input
            type={field.type}
            step={field.type === "number" ? "any" : undefined}
            inputMode={field.type === "number" ? "decimal" : undefined}
            name={field.name}
            placeholder={field.placeholder}
            defaultValue={defaultValues?.[field.name] ?? ""}
            required={field.required}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
          />
        </label>
      ))}

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-500">방향</span>
        <select
          name="direction"
          defaultValue={defaultValues?.direction ?? "Long"}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
        >
          <option value="Long">Long</option>
          <option value="Short">Short</option>
        </select>
      </label>

      <div className="border-t border-gray-100 pt-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">결과</span>
          <select
            name="result"
            defaultValue={defaultValues?.result ?? ""}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
          >
            <option value="">미청산</option>
            <option value="win">승리</option>
            <option value="draw">무승부</option>
            <option value="loss">패배</option>
          </select>
        </label>

        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">결과 메모 (선택)</span>
          <textarea
            name="result_note"
            rows={2}
            defaultValue={defaultValues?.result_note ?? ""}
            className="resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
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
