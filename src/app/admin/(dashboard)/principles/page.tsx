import { getSupabase } from "@/lib/supabase";
import { addNote, deleteNote, updateNote } from "./actions";

export const dynamic = "force-dynamic";

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-gray-500";

interface NoteRow {
  id: string;
  kind: "principle" | "strategy";
  content: string;
}

export default async function PrinciplesAdminPage() {
  const { data } = await getSupabase()
    .from("founder_notes")
    .select("id, kind, content")
    .order("created_at");
  const notes = (data ?? []) as NoteRow[];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
        운영자 매매원칙 및 전략
      </h1>

      <NoteSection
        kind="principle"
        title="매매원칙"
        subtitle="리스크 관리는 의지가 아니라 구조적으로 설계"
        notes={notes.filter((note) => note.kind === "principle")}
      />
      <NoteSection
        kind="strategy"
        title="전략"
        notes={notes.filter((note) => note.kind === "strategy")}
      />
    </div>
  );
}

// 항목마다 바로 고칠 수 있는 입력칸을 두고, 맨 아래에서 새 항목을 추가한다.
function NoteSection({
  kind,
  title,
  subtitle,
  notes,
}: {
  kind: "principle" | "strategy";
  title: string;
  subtitle?: string;
  notes: NoteRow[];
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400">- {subtitle}</p>}
      </div>

      {notes.length === 0 && (
        <p className="mb-3 text-sm text-gray-400">아직 등록된 {title} 없음.</p>
      )}

      <ol className="flex flex-col gap-2">
        {notes.map((note, index) => (
          <li key={note.id} className="flex items-start gap-2">
            <span className="w-5 shrink-0 pt-2 text-sm font-semibold text-gray-400">
              {index + 1}.
            </span>
            <form action={updateNote.bind(null, note.id)} className="flex flex-1 gap-2">
              <textarea
                name="content"
                defaultValue={note.content}
                rows={2}
                required
                className={INPUT_CLASS}
              />
              <button
                type="submit"
                className="shrink-0 self-start rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white dark:bg-gray-100 dark:text-gray-900"
              >
                저장
              </button>
            </form>
            <form action={deleteNote.bind(null, note.id)} className="shrink-0 pt-2">
              <button type="submit" className="text-sm font-medium text-red-500 underline">
                삭제
              </button>
            </form>
          </li>
        ))}
      </ol>

      <form action={addNote.bind(null, kind)} className="mt-4 flex gap-2">
        <textarea
          name="content"
          rows={2}
          required
          placeholder={`새 ${title} 입력`}
          className={INPUT_CLASS}
        />
        <button
          type="submit"
          className="shrink-0 self-start rounded-lg bg-[#3182F6] px-4 py-2 text-sm font-semibold text-white"
        >
          추가
        </button>
      </form>
    </section>
  );
}
