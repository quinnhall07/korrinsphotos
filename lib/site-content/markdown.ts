// lib/site-content/markdown.ts
// Tight Markdown subset for site-editor RICH_TEXT blocks. Pure function, no deps.
//
// Supported (intentionally narrow):
//   - Paragraphs separated by blank lines
//   - `**bold**` and `*italic*`
//   - `[label](href)` links — only http(s) and root-relative paths allowed
//   - `- item` bullet lists (one level)
//
// Everything else (raw HTML, images, headings, code, tables) is escaped as plain text.
// Sustainability: a narrow allow-list never drifts off-brand and has no XSS surface.

const SAFE_HREF = /^(https?:\/\/|\/)[^\s<>"']*$/;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(s: string): string {
  let out = escapeHtml(s);
  // Links: [label](href) — label inside is already escaped above
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, href: string) => {
    const decodedHref = href.replace(/&amp;/g, "&");
    if (!SAFE_HREF.test(decodedHref)) return label;
    const safeHref = escapeHtml(decodedHref);
    const external = decodedHref.startsWith("http");
    const attrs = external
      ? ` target="_blank" rel="noopener noreferrer"`
      : "";
    return `<a href="${safeHref}"${attrs} style="color:var(--olive);text-decoration:underline">${label}</a>`;
  });
  // Bold (greedy-safe with non-greedy match)
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // Italic (single-star, must not collide with bold)
  out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
  return out;
}

// Inline-only variant for one-line surfaces (headings, banner headlines).
// Collapses newlines to spaces and renders inline marks but no block wrappers.
export function renderInlineMarkdown(input: string): string {
  if (!input) return "";
  const collapsed = input.replace(/\r\n/g, "\n").replace(/\s*\n\s*/g, " ").trim();
  return renderInline(collapsed);
}

export function renderConstrainedMarkdown(input: string): string {
  if (!input) return "";
  const blocks = input.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const out: string[] = [];

  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;

    const lines = block.split("\n");
    const isList = lines.every((l) => /^\s*-\s+/.test(l));

    if (isList) {
      const items = lines.map(
        (l) => `<li>${renderInline(l.replace(/^\s*-\s+/, ""))}</li>`
      );
      out.push(
        `<ul style="margin:0 0 1rem 1.2rem;padding:0;list-style:disc">${items.join("")}</ul>`
      );
    } else {
      const joined = lines
        .map((l) => renderInline(l))
        .join("<br />");
      out.push(
        `<p style="margin:0 0 1rem;line-height:1.85;color:var(--charcoal-light)">${joined}</p>`
      );
    }
  }

  return out.join("");
}
