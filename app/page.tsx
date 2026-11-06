import Link from "next/link";
import { Suspense } from "react";
import { AuthNav, SignedOutLinks } from "./_components/AuthNav";
import { HomeContent } from "./_components/HomeContent";

export default function Home() {
  return (
    <>
      <header className="flex items-center justify-between p-4 text-sm">
        <Link href="/" className="font-semibold">HowTags</Link>
        <nav className="flex gap-4">
          <Link href="/search" className="underline">Search</Link>
          <Suspense fallback={<SignedOutLinks />}>
            <AuthNav />
          </Suspense>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-12">
        <HomeContent />
      </main>
    </>
  );
}
