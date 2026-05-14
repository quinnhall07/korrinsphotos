import type { Timestamp } from "firebase-admin/firestore";
import type { LeadStatus, LeadSource, CommunicationChannel } from "@/lib/booking-kanban";

export type { LeadStatus, LeadSource, CommunicationChannel } from "@/lib/booking-kanban";

export interface CommunicationLogEntry {
  id: string;
  timestamp: Timestamp;
  channel: CommunicationChannel;
  summary: string;
  adminUid: string;
}

export interface BookingInquiryDoc {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  sessionType: string;
  preferredDate?: string;
  message: string;
  status: LeadStatus;
  notes: string;
  pricing: string | null;
  leadSource?: LeadSource;
  leadScore?: number;
  tags?: string[];
  estimatedValue?: number;
  followUpDate?: Timestamp | null;
  lastContactedAt?: Timestamp | null;
  lastRespondedAt?: Timestamp | null;
  communicationLog?: CommunicationLogEntry[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
