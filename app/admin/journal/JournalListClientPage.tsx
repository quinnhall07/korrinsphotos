"use client";

// app/admin/journal/JournalListClientPage.tsx
// Admin journal index. Groups by status, renders action buttons per row.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "@/components/ui/Toaster";
import {
  deleteJournalPostAction,
  publishJournalPostAction,
  unpublishJournalPostAction,
} from "./actions";
import type { JournalPostStatus } from "@/lib/db/journal-posts";

export interface SerializedJournalRow {
  id: string;
  slug: string;
  title: string;
  status: JournalPostStatus;
  projectId: string;
  city: string | null;
  locationName: string | null;
  heroPhotoCloudflareId: string | null;
  photoCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  byStatus: Record<JournalPostStatus, SerializedJournalRow[]>;
  error: string | null;
}

const STATUS_ORDER: JournalPostStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

const STATUS_PILL_STYLE: Record<JournalPostStatus, React.CSSProperties> = {
  DRAFT:     { background: "#FEF3C7", color: "#92400E" },
  PUBLISHED: { background: "#D1FAE5", color: "#065F46" },
  ARCHIVED:  { background: "#E5E7EB", color: "#374151" },
};

export function JournalListClientPage({ byStatus, error }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const runAction = (
    fn: () => Promise<{ success: boolean; error?: string }>,
    okMessage: string
  ) => {
    startTransition(async () => {
      const res = await fn();
      if (res.success) {
        toast(okMessage);
        router.refresh();
      } else {
        toast(res.error ?? "Action failed.");
      }
    });
  };

  return (
    <div className="page-fade-in">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "2rem",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "0.65rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--olive)",
              marginBottom: "0.3rem",
            }}
          >
            Content
          </p>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "2rem",
              fontWeight: 300,
            }}
          >
            Journal
          </h2>
        </div>
      </div>

      {error ? (
        <div
          style={{
            padding: "2rem",
            border: "0.5px solid #FCA5A5",
            background: "#FEF2F2",
            color: "#991B1B",
            fontSize: "0.88rem",
            lineHeight: 1.7,
            marginBottom: "2rem",
          }}
        >
          <strong>Error loading posts</strong>
          <br />
          {error}
        </div>
      ) : null}

      {STATUS_ORDER.map((status) => {
        const rows = byStatus[status] ?? [];
        return (
          <section key={status} style={{ marginBottom: "2.5rem" }}>
            <p
              style={{
                fontSize: "0.6rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--charcoal-muted)",
                marginBottom: "0.75rem",
              }}
            >
              {status} ({rows.length})
            </p>

            {rows.length === 0 ? (
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "var(--charcoal-muted)",
                  fontStyle: "italic",
                  padding: "0.5rem 0",
                }}
              >
                None.
              </p>
            ) : (
              <div
                style={{
                  border: "0.5px solid var(--border)",
                  background: "var(--white)",
                }}
              >
                {rows.map((row, idx) => (
                  <div
                    key={row.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 220px 280px",
                      gap: "1rem",
                      alignItems: "center",
                      padding: "1rem 1.2rem",
                      borderTop: idx === 0 ? "none" : "0.5px solid var(--border)",
                    }}
                  >
                    {/* Title */}
                    <div>
                      <p
                        style={{
                          fontSize: "0.92rem",
                          fontWeight: 500,
                          color: "var(--charcoal)",
                          marginBottom: "0.2rem",
                        }}
                      >
                        {row.title}
                      </p>
                      <p
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--charcoal-muted)",
                          letterSpacing: "0.04em",
                        }}
                      >
                        /journal/{row.slug}
                        {row.city ? ` · ${row.city}` : ""}
                        {` · ${row.photoCount} photo${row.photoCount === 1 ? "" : "s"}`}
                      </p>
                    </div>

                    {/* Pill + date */}
                    <div>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.2rem 0.6rem",
                          fontSize: "0.6rem",
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          ...STATUS_PILL_STYLE[row.status],
                        }}
                      >
                        {row.status}
                      </span>
                      {row.publishedAt ? (
                        <p
                          style={{
                            marginTop: "0.4rem",
                            fontSize: "0.7rem",
                            color: "var(--charcoal-muted)",
                          }}
                        >
                          {new Date(row.publishedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      ) : null}
                    </div>

                    {/* Actions */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "0.4rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <Link href={`/admin/journal/${row.id}`} style={smallBtn}>
                        Edit
                      </Link>
                      {row.status === "PUBLISHED" ? (
                        <a
                          href={`/journal/${row.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={smallBtn}
                        >
                          View
                        </a>
                      ) : null}
                      <Link href={`/admin/projects/${row.projectId}`} style={smallBtn}>
                        Project
                      </Link>
                      {row.status !== "PUBLISHED" ? (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            runAction(
                              () => publishJournalPostAction(row.id),
                              "Published."
                            )
                          }
                          style={smallBtnPrimary}
                        >
                          Publish
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            runAction(
                              () => unpublishJournalPostAction(row.id),
                              "Moved back to draft."
                            )
                          }
                          style={smallBtn}
                        >
                          Unpublish
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          if (
                            !confirm(
                              `Delete "${row.title}"? This cannot be undone.`
                            )
                          ) {
                            return;
                          }
                          runAction(
                            () => deleteJournalPostAction(row.id),
                            "Deleted."
                          );
                        }}
                        style={smallBtnDanger}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

const smallBtn: React.CSSProperties = {
  padding: "0.4rem 0.8rem",
  fontSize: "0.68rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  background: "var(--white)",
  color: "var(--charcoal)",
  border: "0.5px solid var(--border-strong)",
  textDecoration: "none",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
};

const smallBtnPrimary: React.CSSProperties = {
  ...smallBtn,
  background: "var(--olive)",
  color: "var(--white)",
  border: "0.5px solid var(--olive)",
};

const smallBtnDanger: React.CSSProperties = {
  ...smallBtn,
  color: "#991B1B",
  border: "0.5px solid #FCA5A5",
};
