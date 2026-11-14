import Link from "next/link";

function Tag({ name }: { name: string }) {
  return (
    <span className="inline-block rounded-md border border-gray-300 bg-gray-100 px-2.5 py-1 font-mono text-sm text-black">
      {name}
    </span>
  );
}

/** The landing page's static content. Reads no cookies, so it prerenders. */
export function HomeContent() {
  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col items-start gap-4">
        <h1 className="text-4xl font-bold">HowTags</h1>
        <p className="text-lg opacity-80">
          A wiki of how-to guides you find by tags, not questions.
        </p>
        <div className="flex flex-wrap gap-2" aria-label="Example tags">
          <Tag name="rust" />
          <Tag name="cargo" />
        </div>
        <Link
          href="/search"
          className="rounded bg-foreground px-5 py-2 font-medium text-background"
        >
          Start searching
        </Link>
      </section>

      <section aria-labelledby="mission-heading" className="flex flex-col gap-3">
        <h2 id="mission-heading" className="text-2xl font-semibold">
          What is HowTags?
        </h2>
        <p>
          HowTags is a wiki of tutorials and how-tos. Instead of typing out a full
          question, you describe what you need with tags such as a programming
          language or library. For example, <Tag name="python" /> <Tag name="print" />{" "}
          leads to the page on printing in Python.
        </p>
        <ul className="list-disc pl-6">
          <li>Enter the exact set of tags for a page, in any order, to open it.</li>
          <li>Suggestions appear as you type, so you can see which tags exist.</li>
          <li>Every page is plain markdown, so it&apos;s quick to read and write.</li>
        </ul>
      </section>

      <section aria-labelledby="contribute-heading" className="flex flex-col gap-3">
        <h2 id="contribute-heading" className="text-2xl font-semibold">
          How to contribute
        </h2>
        <ol className="list-decimal pl-6">
          <li>
            <Link href="/sign-up" className="underline">
              Create an account
            </Link>
            .
          </li>
          <li>Write a page in plain markdown explaining how to do one thing.</li>
          <li>
            Tag it with the language, library, and topic it covers so others can
            find it.
          </li>
        </ol>
        <p className="text-sm opacity-70">Page writing is coming soon.</p>
      </section>
    </div>
  );
}
