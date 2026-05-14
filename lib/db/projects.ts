import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { LeadSource } from "./clients";
import type { CommunicationChannel } from "@/lib/booking-kanban";

export type { CommunicationChannel } from "@/lib/booking-kanban";

export type ProjectStatus =
  | "SITE_VISIT"
  | "INQUIRY"
  | "QUALIFYING"
  | "PROPOSAL_SENT"
  | "NEGOTIATING"
  | "CONTRACT_SENT"
  | "DEPOSIT_PENDING"
  | "BOOKED"
  | "SHOOT_READY"
  | "IN_EDITING"
  | "GALLERY_DELIVERED"
  | "REFERRAL_SENT"
  | "COMPLETED"
  | "LOST"
  | "ARCHIVED";

export type SessionType = "Wedding" | "Engagement" | "Portrait" | "Family" | "Editorial" | "Commercial" | string;

export interface Location {
  label: string;
  lat?: number;
  lng?: number;
  notes?: string;
}

export interface StatusHistoryEntry {
  status: ProjectStatus;
  at: Timestamp;
  byUid?: string;
}

export type LostReason =
  | "BUDGET"
  | "GHOSTED"
  | "DATE_UNAVAILABLE"
  | "LOST_TO_COMPETITOR"
  | "OTHER";

export interface WeatherSnapshot {
  temp: number;
  conditions: string;
  fetchedAt: Timestamp;
}

export interface ProjectDoc {
  id: string;
  clientId: string;
  status: ProjectStatus;
  sessionType: SessionType;
  title: string;
  shootDate?: Timestamp | null;
  shootEndDate?: Timestamp | null;
  shootLocation?: Location | null;
  packageName?: string | null;
  packagePriceUsd?: number | null;
  discountApplied?: number | null;
  depositPaidAt?: Timestamp | null;
  balancePaidAt?: Timestamp | null;
  contractSignedAt?: Timestamp | null;
  deliveredAt?: Timestamp | null;
  referralLinkSentAt?: Timestamp | null;
  leadScore: number;
  leadSource: LeadSource;
  tags: string[];
  estimatedValue?: number | null;
  followUpDate?: Timestamp | null;
  lastContactedAt?: Timestamp | null;
  lastRespondedAt?: Timestamp | null;
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  statusHistory?: StatusHistoryEntry[];
  lostReason?: LostReason;
  engagementScore?: number;
  lastEngagementAt?: Timestamp;
  clientNps?: 1 | 2 | 3 | 4 | 5;
  clientNpsAt?: Timestamp;
  weatherSnapshot?: WeatherSnapshot;
  shootBriefR2Key?: string;
  /** Phase 2.7 welcome packet — set by `lib/domain/welcome-packet.ts`. */
  welcomePacketR2Key?: string;
  welcomePacketGeneratedAt?: Timestamp;
  /** 32-char hex token. Re-minted on each regeneration. The public read
   *  route checks `?t=<token>` against this; expiry is enforced by the R2
   *  presigned-URL lifetime. */
  welcomePacketToken?: string;
}

export interface MessageDoc {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  channel: CommunicationChannel;
  subject?: string | null;
  body: string;
  adminUid?: string | null;
  sentAt: Timestamp;
  isAutomatic: boolean;
}

export const projectsCol = () => adminDb.collection("projects");
export const projectMessagesCol = (projectId: string) => projectsCol().doc(projectId).collection("messages");

export async function getProject(id: string): Promise<ProjectDoc | null> {
  const snap = await projectsCol().doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as ProjectDoc) : null;
}

export async function createProject(data: Omit<ProjectDoc, "id" | "createdAt" | "updatedAt">): Promise<ProjectDoc> {
  const ref = projectsCol().doc();
  const now = Timestamp.now();
  const fullData = { ...data, createdAt: now, updatedAt: now };
  await ref.set(fullData);
  return { id: ref.id, ...fullData } as ProjectDoc;
}

export async function updateProject(id: string, data: Partial<Omit<ProjectDoc, "id" | "createdAt" | "clientId">>): Promise<void> {
  await projectsCol().doc(id).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function listProjects(status?: ProjectStatus): Promise<ProjectDoc[]> {
  let query = projectsCol().orderBy("createdAt", "desc") as FirebaseFirestore.Query;
  if (status) query = query.where("status", "==", status);
  const snap = await query.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProjectDoc));
}

export async function getProjectsByClientId(clientId: string): Promise<ProjectDoc[]> {
  const snap = await projectsCol().where("clientId", "==", clientId).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProjectDoc));
}

export async function addProjectMessage(projectId: string, message: Omit<MessageDoc, "id" | "sentAt">): Promise<MessageDoc> {
  const ref = projectMessagesCol(projectId).doc();
  const fullMessage = { ...message, sentAt: Timestamp.now() };
  await ref.set(fullMessage);
  return { id: ref.id, ...fullMessage } as MessageDoc;
}
