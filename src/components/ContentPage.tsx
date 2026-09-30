import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";

// 소개/개인정보처리방침/가이드처럼 글 위주 페이지의 공통 틀.
// 본문 태그(h2, p, ul...) 스타일을 여기서 한 번에 지정해서 각 페이지는 내용만 쓰면 되게 한다.
export default function ContentPage({
  title,
  description,
  updatedAt,
  children,
}: {
  title: string;
  description?: string;
  updatedAt?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-indigo-50/40 to-indigo-50 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900">
      <Navbar />
      <main className="px-6 py-10">
        <article className="mx-auto max-w-3xl rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-10">
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">{title}</h1>
          {description && (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{description}</p>
          )}
          {updatedAt && <p className="mt-1 text-xs text-gray-400">최종 수정: {updatedAt}</p>}
          <div className="mt-6 text-[15px] leading-7 text-gray-700 dark:text-gray-300 [&_a]:text-indigo-600 [&_a]:underline dark:[&_a]:text-indigo-400 [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-gray-900 dark:[&_h2]:text-gray-100 [&_h3]:mb-1 [&_h3]:mt-5 [&_h3]:font-bold [&_h3]:text-gray-900 dark:[&_h3]:text-gray-100 [&_li]:mt-1 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-3 [&_strong]:text-gray-900 dark:[&_strong]:text-gray-100 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
            {children}
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
