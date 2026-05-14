// components/JsonLd.tsx
// Server Component that renders a single JSON-LD <script> tag. Accepts any
// schema.org-shaped object (or array of them) built via @/lib/seo/schema.
// No "use client" — must remain server-rendered so the JSON is present on
// first byte for crawlers.

type JsonLdValue =
  | string
  | number
  | boolean
  | null
  | JsonLdValue[]
  | { [key: string]: JsonLdValue };

export function JsonLd({ data }: { data: JsonLdValue | JsonLdValue[] }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify on a plain schema object is safe; values are
      // controlled at the call site (no user-supplied raw HTML).
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
