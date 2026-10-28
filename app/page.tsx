import Link from "next/link";
import { SearchBox } from "./_components/SearchBox/SearchBox";

export default function Home() {
  return (
    <>
      <nav className="flex justify-end gap-4 p-4 text-sm">
        <Link href="/sign-up" className="underline">Sign up</Link>
        <Link href="/sign-in" className="underline">Sign in</Link>
      </nav>
      <SearchBox
        tagList={["c", "cpp", "csharp", "html", "css", "nextjs", "cargo", "npm", "rust"]}
      />
    </>
  );
}
