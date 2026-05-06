import type { CSSProperties } from "react";

export type LeadStatus =
  | "PENDING"
  | "QUALIFIED"
  | "SENT_PROPOSAL"
  | "CONTRACT_SENT"
  | "BOOKED"
  | "ARCHIVED";

export type LeadSource = "WEBSITE" | "INSTAGRAM" | "REFERRAL" | "GOOGLE" | "OTHER";

export type CommunicationChannel = "EMAIL" | "PHONE" | "SMS" | "IN_PERSON";

export const PRESET_TAGS = [
  "VIP",
  "Rush",
  "Return Client",
  "Destination",
  "High-Budget",
  "Budget-Conscious",
  "Referred",
  "Social Media",
  "Needs Follow-Up",
] as const;

export const KANBAN_STATUSES: {
  id: LeadStatus;
  label: string;
  badgeStyle: CSSProperties;
}[] = [
  {
    id: "PENDING",
    label: "New Leads",
    badgeStyle: { background: "#FEF3C7", color: "#92400E" },
  },
  {
    id: "QUALIFIED",
    label: "Qualified",
    badgeStyle: { background: "#E0E7FF", color: "#3730A3" },
  },
  {
    id: "SENT_PROPOSAL",
    label: "Proposal Sent",
    badgeStyle: { background: "#DBEAFE", color: "#1D4ED8" },
  },
  {
    id: "CONTRACT_SENT",
    label: "Contract Out",
    badgeStyle: { background: "#FED7AA", color: "#9A3412" },
  },
  {
    id: "BOOKED",
    label: "Booked",
    badgeStyle: { background: "#D1FAE5", color: "#065F46" },
  },
];

export const ALL_STATUSES: LeadStatus[] = [
  "PENDING",
  "QUALIFIED",
  "SENT_PROPOSAL",
  "CONTRACT_SENT",
  "BOOKED",
  "ARCHIVED",
];
