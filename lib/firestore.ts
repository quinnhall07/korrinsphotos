// lib/firestore.ts
// Firestore data-access helpers — server-side only.
// Replaces Prisma + PostgreSQL. All collections are defined here.
//
// Collections:
//   users/{uid}               — profile + role
//   events/{eventId}          — photo sessions/events
//   photos/{photoId}          — individual images
//   eventAccess/{docId}       — links userId ↔ eventId
//   bookingInquiries/{id}     — public booking form submissions
//   mail/{id}                 — picked up by Firebase "Trigger Email" extension

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Role = "ADMIN" | "CLIENT";

export interface UserDoc {
  uid:         string;
  email:       string;
  displayName?: string;
  photoURL?:   string;
  role:        Role;
  createdAt:   Timestamp;
}

export interface EventDoc {
  id:            string;
  title:         string;
  coverPhotoUrl?: string;
  createdAt:     Timestamp;
  updatedAt:     Timestamp;
}

export interface PhotoDoc {
  id:                 string;
  eventId:            string;
  cloudflareUrl:      string;
  cloudflareImageId:  string;
  label?:             string;
  category?:          string; // "wedding" | "portrait" | "editorial" | "landscape"
  uploadedAt:         Timestamp;
}

export interface EventAccessDoc {
  id:        string;
  userId:    string;
  eventId:   string;
  email:     string;
  createdAt: Timestamp;
}

export interface BookingInquiryDoc {
  id:            string;
  firstName:     string;
  lastName:      string;
  email:         string;
  sessionType:   string;
  preferredDate?: string;
  message:       string;
  status:        "PENDING" | "REVIEWED" | "BOOKED" | "ARCHIVED";
  createdAt:     Timestamp;
  updatedAt:     Timestamp;
}

// ─── Collection refs ──────────────────────────────────────────────────────────

export const usersCol         = () => adminDb.collection("users");
export const eventsCol        = () => adminDb.collection("events");
export const photosCol        = () => adminDb.collection("photos");
export const eventAccessCol   = () => adminDb.collection("eventAccess");
export const bookingCol       = () => adminDb.collection("bookingInquiries");
export const mailCol          = () => adminDb.collection("mail"); // Trigger Email

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUser(uid: string): Promise<UserDoc | null> {
  const snap = await usersCol().doc(uid).get();
  return snap.exists ? ({ uid, ...snap.data() } as UserDoc) : null;
}

export async function upsertUser(uid: string, data: Partial<UserDoc>): Promise<void> {
  await usersCol().doc(uid).set(
    { ...data, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
}

export async function listUsers(): Promise<UserDoc[]> {
  const snap = await usersCol().orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserDoc));
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function getEvent(eventId: string): Promise<EventDoc | null> {
  const snap = await eventsCol().doc(eventId).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as EventDoc) : null;
}

export async function listEvents(): Promise<EventDoc[]> {
  const snap = await eventsCol().orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as EventDoc));
}

export async function createEvent(title: string): Promise<EventDoc> {
  const ref = eventsCol().doc();
  const now = Timestamp.now();
  const data = { title, createdAt: now, updatedAt: now };
  await ref.set(data);
  return { id: ref.id, ...data };
}

export async function updateEvent(eventId: string, data: Partial<EventDoc>): Promise<void> {
  await eventsCol().doc(eventId).update({
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// ─── Photos ───────────────────────────────────────────────────────────────────

export async function listPhotos(eventId: string): Promise<PhotoDoc[]> {
  const snap = await photosCol()
    .where("eventId", "==", eventId)
    .orderBy("uploadedAt", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PhotoDoc));
}

export async function listPublicPhotos(limit = 9): Promise<PhotoDoc[]> {
  const snap = await photosCol()
    .where("category", "!=", null)
    .orderBy("category")
    .orderBy("uploadedAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PhotoDoc));
}

export async function createPhoto(data: Omit<PhotoDoc, "id" | "uploadedAt">): Promise<PhotoDoc> {
  const ref = photosCol().doc();
  const uploadedAt = Timestamp.now();
  await ref.set({ ...data, uploadedAt });
  return { id: ref.id, ...data, uploadedAt };
}

export async function deletePhoto(photoId: string): Promise<void> {
  await photosCol().doc(photoId).delete();
}

export async function countPhotos(eventId: string): Promise<number> {
  const snap = await photosCol().where("eventId", "==", eventId).count().get();
  return snap.data().count;
}

// ─── Event Access ─────────────────────────────────────────────────────────────

export async function grantEventAccess(
  userId: string,
  eventId: string,
  email: string
): Promise<void> {
  // Idempotent: use a deterministic doc ID so duplicate grants are safe
  const docId = `${eventId}_${userId}`;
  await eventAccessCol().doc(docId).set(
    { userId, eventId, email, createdAt: Timestamp.now() },
    { merge: true }
  );
}

export async function revokeEventAccess(userId: string, eventId: string): Promise<void> {
  const docId = `${eventId}_${userId}`;
  await eventAccessCol().doc(docId).delete();
}

export async function userHasEventAccess(userId: string, eventId: string): Promise<boolean> {
  const docId = `${eventId}_${userId}`;
  const snap  = await eventAccessCol().doc(docId).get();
  return snap.exists;
}

export async function listEventAccess(eventId: string): Promise<EventAccessDoc[]> {
  const snap = await eventAccessCol()
    .where("eventId", "==", eventId)
    .orderBy("createdAt", "asc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as EventAccessDoc));
}

export async function listUserEvents(userId: string): Promise<string[]> {
  const snap = await eventAccessCol().where("userId", "==", userId).get();
  return snap.docs.map((d) => (d.data() as EventAccessDoc).eventId);
}

export async function countEventAccess(eventId: string): Promise<number> {
  const snap = await eventAccessCol().where("eventId", "==", eventId).count().get();
  return snap.data().count;
}

// ─── Booking Inquiries ────────────────────────────────────────────────────────

export async function createBookingInquiry(
  data: Omit<BookingInquiryDoc, "id" | "createdAt" | "updatedAt">
): Promise<BookingInquiryDoc> {
  const ref = bookingCol().doc();
  const now = Timestamp.now();
  const full = { ...data, status: "PENDING" as const, createdAt: now, updatedAt: now };
  await ref.set(full);
  return { id: ref.id, ...full };
}

export async function listBookingInquiries(
  status?: BookingInquiryDoc["status"]
): Promise<BookingInquiryDoc[]> {
  let query = bookingCol().orderBy("createdAt", "desc") as FirebaseFirestore.Query;
  if (status) query = query.where("status", "==", status);
  const snap = await query.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as BookingInquiryDoc));
}

export async function updateBookingStatus(
  id: string,
  status: BookingInquiryDoc["status"]
): Promise<void> {
  await bookingCol().doc(id).update({ status, updatedAt: FieldValue.serverTimestamp() });
}

export async function countBookingInquiries(status?: string): Promise<number> {
  let query = bookingCol() as FirebaseFirestore.Query;
  if (status) query = query.where("status", "==", status);
  const snap = await query.count().get();
  return snap.data().count;
}

// ─── Email (Trigger Email extension) ─────────────────────────────────────────
// Write a document to the `mail` collection. The Firebase "Trigger Email"
// Firestore extension automatically picks it up and dispatches it via the
// SMTP provider you configure in the extension settings.

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  await mailCol().add({
    to,
    message: { subject, html },
    createdAt: Timestamp.now(),
  });
}

// ─── Dashboard aggregates ─────────────────────────────────────────────────────

export async function getDashboardCounts() {
  const [eventsSnap, photosSnap, pendingSnap, clientsSnap] = await Promise.all([
    eventsCol().count().get(),
    photosCol().count().get(),
    bookingCol().where("status", "==", "PENDING").count().get(),
    usersCol().where("role", "==", "CLIENT").count().get(),
  ]);

  return {
    events:          eventsSnap.data().count,
    photos:          photosSnap.data().count,
    pendingInquiries: pendingSnap.data().count,
    clients:         clientsSnap.data().count,
  };
}