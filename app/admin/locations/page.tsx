// app/admin/locations/page.tsx
// Lists every scouted location. Server Component fetches the data, serialises
// timestamps, and delegates rendering + filtering to LocationsClientPage.

import { requireAdmin } from "@/lib/session";
import { listLocations, type LocationDoc } from "@/lib/db/locations";
import { LocationsClientPage, type SerializedLocation } from "./LocationsClientPage";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Locations | Admin" };
export const dynamic = "force-dynamic";

function serialiseLocation(doc: LocationDoc): SerializedLocation {
  return {
    id: doc.id,
    name: doc.name,
    type: doc.type,
    address: doc.address ?? null,
    city: doc.city ?? null,
    state: doc.state ?? null,
    latitude: typeof doc.latitude === "number" ? doc.latitude : null,
    longitude: typeof doc.longitude === "number" ? doc.longitude : null,
    bestLightWindow: doc.bestLightWindow ?? null,
    parkingNotes: doc.parkingNotes ?? null,
    permitRequired: doc.permitRequired ?? false,
    permitCost: typeof doc.permitCost === "number" ? doc.permitCost : null,
    permitContact: doc.permitContact ?? null,
    accessibilityNotes: doc.accessibilityNotes ?? null,
    capacityMax: typeof doc.capacityMax === "number" ? doc.capacityMax : null,
    weatherDependent: doc.weatherDependent ?? false,
    rating: doc.rating ?? null,
    visitCount: doc.visitCount ?? 0,
    lastVisited: doc.lastVisited ? doc.lastVisited.toDate().toISOString() : null,
    sampleEventIds: doc.sampleEventIds ?? [],
    notes: doc.notes ?? null,
    tags: doc.tags ?? [],
    createdAt: doc.createdAt.toDate().toISOString(),
  };
}

export default async function LocationsPage() {
  await requireAdmin();

  let locations: SerializedLocation[] = [];
  let error: string | null = null;

  try {
    const docs = await listLocations();
    locations = docs.map(serialiseLocation);
  } catch (err) {
    console.error("Failed to list locations:", err);
    error = err instanceof Error ? err.message : "Failed to load locations.";
  }

  if (error) {
    return (
      <div className="page-fade-in">
        <div
          style={{
            padding: "2rem",
            border: "0.5px solid #FCA5A5",
            background: "#FEF2F2",
            color: "#991B1B",
            fontSize: "0.88rem",
            lineHeight: 1.7,
          }}
        >
          <strong>Error loading locations</strong>
          <br />
          {error}
        </div>
      </div>
    );
  }

  return <LocationsClientPage locations={locations} />;
}
