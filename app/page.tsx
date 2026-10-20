import { SearchBox } from "./_components/SearchBox/SearchBox";

export default function Home() {
  return (
      <SearchBox
        tagList={["c", "cpp", "csharp", "html", "css", "nextjs", "cargo", "npm", "rust"]}
      />
  );
}
