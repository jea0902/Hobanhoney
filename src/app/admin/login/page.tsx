import { login } from "../actions";

export default function AdminLoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F6F8] p-6">
      <form
        action={login}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6"
      >
        <h1 className="text-lg font-bold text-gray-900">관리자 로그인</h1>
        <input
          type="password"
          name="password"
          placeholder="비밀번호"
          autoFocus
          required
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
        />
        {searchParams.error && (
          <p className="text-xs font-medium text-red-500">비밀번호가 올바르지 않아요.</p>
        )}
        <button
          type="submit"
          className="rounded-lg bg-[#3182F6] px-4 py-2 text-sm font-semibold text-white"
        >
          로그인
        </button>
      </form>
    </main>
  );
}
