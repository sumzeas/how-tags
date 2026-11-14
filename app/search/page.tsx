import type { Metadata } from "next";
import { SearchBox } from "../_components/SearchBox/SearchBox";

export const metadata: Metadata = {
  title: "Search · HowTags",
};

export default function SearchPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-12">
      <h1 className="text-2xl font-semibold">Search</h1>
      <p className="opacity-70">Type a tag and press space to add it.</p>
      <SearchBox
        tagList={["c", "cpp", "csharp", "html", "css", "nextjs", "cargo", "npm", "rust"]}
      />
    </main>
  );
}
