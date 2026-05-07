import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export type Role = "ADMIN" | "CLIENT";
export type LeadSource = "WEBSITE" | "INSTAGRAM" | "GOOGLE" | "REFERRAL" | "DIRECT" | "OTHER";

export interface ClientDoc {
  id: string; // Firebase UID once registered, otherwise generated
  email: string; // UNIQUE
  firstName: string;
  lastName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: Role;
  referralCode: string;
  referredBy?: string | null;
  referralCredit: number; // in cents
  totalSessionsBooked: number;
  firstTouchSource: LeadSource;
  firstTouchMedium?: string | null;
  firstTouchCampaign?: string | null;
  firstTouchLandingUrl?: string | null;
  firstTouchAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const clientsCol = () => adminDb.collection("clients");

export async function getClient(id: string): Promise<ClientDoc | null> {
  const snap = await clientsCol().doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as ClientDoc) : null;
}

export async function getClientByEmail(email: string): Promise<ClientDoc | null> {
  const snap = await clientsCol().where("email", "==", email).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as ClientDoc;
}

export async function createClient(data: Omit<ClientDoc, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<ClientDoc> {
  const ref = data.id ? clientsCol().doc(data.id) : clientsCol().doc();
  const now = Timestamp.now();
  const { id, ...docData } = data;
  const fullData = { ...docData, createdAt: now, updatedAt: now };
  await ref.set(fullData);
  return { id: ref.id, ...fullData } as ClientDoc;
}

export async function updateClient(id: string, data: Partial<Omit<ClientDoc, "id" | "createdAt" | "email">>): Promise<void> {
  await clientsCol().doc(id).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export function generateReferralCode(firstName: string): string {
  const slug = firstName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const randomChars = Math.random().toString(36).substring(2, 6);
  return `${slug}-${randomChars}`;
}
