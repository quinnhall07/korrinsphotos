// lib/firestore.ts
// DEPRECATED: This file is a legacy facade. Please import from lib/db/* instead.
// We keep this to prevent breaking existing imports.

export * from "./db/users";
export * from "./db/events";
export * from "./db/photos";
export * from "./db/event-access";
export * from "./db/bookings";
export * from "./db/activity";
export * from "./db/mail";

import { eventsCol } from "./db/events";
import { photosCol } from "./db/photos";
import { bookingCol } from "./db/bookings";
import { usersCol } from "./db/users";

// ─── Dashboard aggregates ─────────────────────────────────────────────────────

export async function getDashboardCounts() {
  const [eventsSnap, photosSnap, pendingSnap, clientsSnap] = await Promise.all([
    eventsCol().count().get(),
    photosCol().count().get(),
    bookingCol().where("status", "==", "PENDING").count().get(),
    usersCol().where("role", "==", "CLIENT").count().get(),
  ]);

  return {
    events: eventsSnap.data().count,
    photos: photosSnap.data().count,
    pendingInquiries: pendingSnap.data().count,
    clients: clientsSnap.data().count,
  };
}
