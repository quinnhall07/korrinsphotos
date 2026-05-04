// app/gallery/page.tsx
// Client portal dashboard — shows every event this user has been granted access to.
// Server-side auth guard via requireSession(); redirects to /login if no session.

import Link from "next/link";
import { requireSession } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import { buildCdnUrl } from "@/lib/cloudflare";
import { Footer } from "@/components/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Galleries",
  description: "Your private photo galleries from Korrin's Photos.",
};

export const dynamic = "force-dynamic";

type EventCard = {
  id: string;
  title: string;
  photoCount: number;
  createdAt: Date;
  coverUrl: string | null;
};

async function getClientEvents(userId: string): Promise<EventCard[]> {
  try {
    // Use a simple where query without orderBy to avoid needing a composite index
    const accessSnap = await adminDb
      .collection("eventAccess")
      .where("userId", "==", userId)
      .get();

    if (accessSnap.empty) return [];

    const eventIds = accessSnap.docs.map((d) => d.data().eventId as string);

    const events = await Promise.all(
      eventIds.map(async (eventId) => {
        try {
          const [eventDoc, photosCountSnap, firstPhotoSnap] = await Promise.all([
            adminDb.collection("events").doc(eventId).get(),
            adminDb
              .collection("events")
              .doc(eventId)
              .collection("photos")
              .count()
              .get(),
            adminDb
              .collection("events")
              .doc(eventId)
              .collection("photos")
              .orderBy("uploadedAt", "asc")
              .limit(1)
              .get(),
          ]);

          if (!eventDoc.exists) return null;

          const data = eventDoc.data()!;
          const coverPhoto = firstPhotoSnap.empty
            ? null
            : firstPhotoSnap.docs[0].data();

          return {
            id: eventId,
            title: data.title as string,
            photoCount: photosCountSnap.data().count,
            createdAt: data.createdAt?.toDate() ?? new Date(),
            coverUrl: coverPhoto?.cloudflareImageId
              ? buildCdnUrl(coverPhoto.cloudflareImageId, "thumbnail")
              : null,
          };
        } catch {
          return null;
        }
      })
    );

    return events.filter(Boolean) as EventCard[];
  } catch {
    // Return empty array on any Firestore error (missing index, etc.)
    return [];
  }
}

export default async function GalleryPage() {
  const session = await requireSession();
  
  let events: EventCard[] = [];
  try {
    events = await getClientEvents(session.uid);
  } catch {
    // Silently fall through to empty state
  }

  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      {/* Header */}
      <div
        style={{
          padding: "4rem 4rem 2rem",
          borderBottom: "0.5px solid var(--border)",
          marginBottom: "3rem",
        }}
      >
        <p
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
            marginBottom: "0.75rem",
          }}
        >
          Client Portal
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "clamp(2.2rem, 5vw, 3.5rem)",
            fontWeight: 300,
            marginBottom: "0.5rem",
          }}
        >
          Your <em>galleries</em>
        </h1>
        <p style={{ fontSize: "0.82rem", color: "var(--charcoal-muted)" }}>
          {session.email}
        </p>
      </div>

      {/* Content */}
      {events.length === 0 ? (
        <div
          style={{
            padding: "6rem 4rem",
            textAlign: "center",
            maxWidth: "36rem",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "var(--olive-dim)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.5rem",
              color: "var(--olive)",
              fontSize: "1.4rem",
            }}
          >
            ◎
          </div>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "2rem",
              fontWeight: 300,
              marginBottom: "0.75rem",
            }}
          >
            No galleries yet
          </h2>
          <p
            style={{
              fontSize: "0.88rem",
              color: "var(--charcoal-muted)",
              lineHeight: 1.8,
              marginBottom: "2rem",
            }}
          >
            Your photos will appear here once Korrin finishes editing and shares
            your gallery. You&apos;ll receive an email notification when
            they&apos;re ready.
          </p>
          <Link
            href="/"
            style={{
              display: "inline-block",
              padding: "0.75rem 2rem",
              fontSize: "0.72rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              background: "transparent",
              color: "var(--charcoal)",
              border: "0.5px solid var(--border-strong)",
              textDecoration: "none",
            }}
          >
            Return Home
          </Link>
        </div>
      ) : (
        <div
          style={{
            padding: "0 4rem 4rem",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "1.5rem",
          }}
        >
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/gallery/${event.id}`}
              style={{
                cursor: "pointer",
                overflow: "hidden",
                border: "0.5px solid var(--border)",
                textDecoration: "none",
                color: "inherit",
                display: "block",
                transition: "border-color 0.2s",
              }}
            >
              {/* Cover image */}
              <div
                style={{
                  position: "relative",
                  aspectRatio: "4/3",
                  overflow: "hidden",
                  background: "var(--olive-dim)",
                }}
              >
                {event.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={event.coverUrl}
                    alt={event.title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                      transition: "transform 0.6s",
                      pointerEvents: "none",
                      userSelect: "none",
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    draggable={false}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--charcoal-muted)",
                        fontSize: "0.72rem",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                      }}
                    >
                      Coming soon
                    </span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div
                style={{
                  padding: "1.2rem",
                  borderTop: "0.5px solid var(--border)",
                }}
              >
                <h3
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "1.2rem",
                    fontWeight: 400,
                    marginBottom: "0.25rem",
                  }}
                >
                  {event.title}
                </h3>
                <p
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--charcoal-muted)",
                    letterSpacing: "0.06em",
                  }}
                >
                  {event.photoCount} photo{event.photoCount !== 1 ? "s" : ""} ·{" "}
                  {event.createdAt.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Footer />
    </div>
  );
}