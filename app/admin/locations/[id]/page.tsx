// app/admin/locations/[id]/page.tsx
// Detail view for a single scouted location. Server Component fetches the
// location + any linked sample events, then delegates rendering / editing /
// deletion to the client component.

import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import { getLocation, LOCATION_TYPE_LABELS } from "@/lib/db/locations";
import { LocationDetailClient } from "./LocationDetailClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const loc = await getLocation(id);
  return { title: loc ? `${loc.name} | Locations | Admin` : "Location | Admin" };
}

export default async function LocationDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const location = await getLocation(id);
  if (!location) notFound();

  // Best-effort fetch of linked sample events for display.
  const sampleEventIds = location.sampleEventIds ?? [];
  const sampleEvents = await Promise.all(
    sampleEventIds.slice(0, 25).map(async (eventId) => {
      try {
        const snap = await adminDb.collection("events").doc(eventId).get();
        if (!snap.exists) return null;
        return {
          id: eventId,
          title: (snap.data()?.title as string) ?? "Untitled event",
        };
      } catch {
        return null;
      }
    })
  );

  const serialised = {
    id: location.id,
    name: location.name,
    type: location.type,
    typeLabel: LOCATION_TYPE_LABELS[location.type],
    address: location.address ?? null,
    city: location.city ?? null,
    state: location.state ?? null,
    latitude: typeof location.latitude === "number" ? location.latitude : null,
    longitude: typeof location.longitude === "number" ? location.longitude : null,
    bestLightWindow: location.bestLightWindow ?? null,
    parkingNotes: location.parkingNotes ?? null,
    permitRequired: location.permitRequired ?? false,
    permitCost: typeof location.permitCost === "number" ? location.permitCost : null,
    permitContact: location.permitContact ?? null,
    accessibilityNotes: location.accessibilityNotes ?? null,
    capacityMax: typeof location.capacityMax === "number" ? location.capacityMax : null,
    weatherDependent: location.weatherDependent ?? false,
    rating: location.rating ?? null,
    visitCount: location.visitCount ?? 0,
    lastVisited: location.lastVisited ? location.lastVisited.toDate().toISOString() : null,
    notes: location.notes ?? null,
    tags: location.tags ?? [],
    sampleEvents: sampleEvents.filter(
      (e): e is { id: string; title: string } => e !== null
    ),
  };

  return (
    <div className="page-fade-in">
      <div style={{ marginBottom: "1.25rem" }}>
        <Link
          href="/admin/locations"
          style={{
            fontSize: "0.7rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            textDecoration: "none",
          }}
        >
          ← All locations
        </Link>
      </div>

      <LocationDetailClient location={serialised} />
    </div>
  );
}
