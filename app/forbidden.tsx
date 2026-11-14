import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-4 px-4 py-12">
      <h1 className="text-2xl font-semibold">403 Forbidden</h1>
      <p>You don&apos;t have access to this page.</p>
      <Link href="/" className="underline">Return home</Link>
    </main>
  );
}
