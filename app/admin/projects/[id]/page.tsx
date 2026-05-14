import type { Metadata } from "next";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import { notFound } from "next/navigation";
import type { ProjectStatus } from "@/lib/db/projects";
import { ProjectWorkspaceClient } from "./ProjectWorkspaceClient";

export const metadata: Metadata = { title: "Project Detail | Admin" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/**
 * Next-best-action hint per status. Pure mapping — exported so other code
 * (Kanban cards, inbox, etc.) can render the same chip if needed.
 */
export function getNextBestAction(status: ProjectStatus | string): string {
  switch (status) {
    case "SITE_VISIT":
      return "Confirm site visit";
    case "INQUIRY":
      return "Send proposal";
    case "QUALIFYING":
      return "Qualify lead";
    case "PROPOSAL_SENT":
      return "Follow up";
    case "NEGOTIATING":
      return "Close the deal";
    case "CONTRACT_SENT":
      return "Nudge for signature";
    case "DEPOSIT_PENDING":
      return "Resend invoice";
    case "BOOKED":
      return "Send questionnaire";
    case "SHOOT_READY":
      return "Confirm logistics";
    case "IN_EDITING":
      return "Update editing ETA";
    case "GALLERY_DELIVERED":
      return "Request review";
    case "REFERRAL_SENT":
      return "Thank for referral";
    case "COMPLETED":
      return "Archive";
    case "LOST":
      return "Move to nurture";
    case "ARCHIVED":
      return "—";
    default:
      return "Review";
  }
}

// ─── Serialisable shapes for the client component ─────────────────────────────

export type SerialProject = {
  id: string;
  clientId: string;
  status: ProjectStatus | string;
  sessionType: string;
  title: string;
  shootDate: string | null;
  shootEndDate: string | null;
  shootLocation: { label?: string | null; lat?: number | null; lng?: number | null; notes?: string | null } | null;
  packageName: string | null;
  packagePriceUsd: number | null;
  discountApplied: number | null;
  estimatedValue: number | null;
  leadScore: number;
  leadSource: string;
  tags: string[];
  notes: string;
  followUpDate: string | null;
  lastContactedAt: string | null;
  lastRespondedAt: string | null;
  depositPaidAt: string | null;
  balancePaidAt: string | null;
  contractSignedAt: string | null;
  deliveredAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  statusHistory: { status: string; at: string; byUid?: string | null }[];
};

export type SerialClient = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  firstTouchSource: string;
  referralCredit: number;
  totalSessionsBooked: number;
};

export type SerialMessage = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  channel: string;
  subject: string | null;
  body: string;
  adminUid: string | null;
  sentAt: string | null;
  isAutomatic: boolean;
};

export type SerialContract = {
  id: string;
  projectId: string;
  clientId: string;
  status: "DRAFT" | "SENT" | "SIGNED" | "VOIDED" | string;
  templateId: string;
  renderedHtml: string;
  signerIp: string | null;
  signerUserAgent: string | null;
  sentAt: string | null;
  signedAt: string | null;
  createdAt: string | null;
};

export type SerialInvoice = {
  id: string;
  projectId: string;
  clientId: string;
  type: string;
  status: string;
  amountCents: number;
  dueDate: string | null;
  paidAt: string | null;
  sentAt: string | null;
  stripePaymentLinkUrl: string | null;
  createdAt: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ts(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && typeof value.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProjectDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const projectSnap = await adminDb.collection("projects").doc(id).get();
  if (!projectSnap.exists) notFound();
  const projectData = projectSnap.data()!;

  const clientId: string = projectData.clientId;

  // Fan-out: client, messages, invoices, latest contract, linked event.
  const [clientSnap, messagesSnap, invoicesSnap, contractsSnap, eventsSnap] = await Promise.all([
    adminDb.collection("clients").doc(clientId).get(),
    adminDb
      .collection("projects")
      .doc(id)
      .collection("messages")
      .orderBy("sentAt", "asc")
      .get(),
    adminDb.collection("invoices").where("projectId", "==", id).get(),
    adminDb
      .collection("contracts")
      .where("projectId", "==", id)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get(),
    adminDb.collection("events").where("projectId", "==", id).limit(1).get(),
  ]);

  const clientData = clientSnap.data();

  const project: SerialProject = {
    id,
    clientId,
    status: projectData.status,
    sessionType: projectData.sessionType ?? "",
    title: projectData.title ?? "Untitled project",
    shootDate: ts(projectData.shootDate),
    shootEndDate: ts(projectData.shootEndDate),
    shootLocation: projectData.shootLocation
      ? {
          label: projectData.shootLocation.label ?? null,
          lat: projectData.shootLocation.lat ?? null,
          lng: projectData.shootLocation.lng ?? null,
          notes: projectData.shootLocation.notes ?? null,
        }
      : null,
    packageName: projectData.packageName ?? null,
    packagePriceUsd: projectData.packagePriceUsd ?? null,
    discountApplied: projectData.discountApplied ?? null,
    estimatedValue: projectData.estimatedValue ?? null,
    leadScore: projectData.leadScore ?? 0,
    leadSource: projectData.leadSource ?? "DIRECT",
    tags: Array.isArray(projectData.tags) ? projectData.tags : [],
    notes: typeof projectData.notes === "string" ? projectData.notes : "",
    followUpDate: ts(projectData.followUpDate),
    lastContactedAt: ts(projectData.lastContactedAt),
    lastRespondedAt: ts(projectData.lastRespondedAt),
    depositPaidAt: ts(projectData.depositPaidAt),
    balancePaidAt: ts(projectData.balancePaidAt),
    contractSignedAt: ts(projectData.contractSignedAt),
    deliveredAt: ts(projectData.deliveredAt),
    createdAt: ts(projectData.createdAt),
    updatedAt: ts(projectData.updatedAt),
    statusHistory: Array.isArray(projectData.statusHistory)
      ? projectData.statusHistory.map((h: any) => ({
          status: h.status,
          at: ts(h.at) ?? "",
          byUid: h.byUid ?? null,
        }))
      : [],
  };

  const client: SerialClient = {
    id: clientId,
    email: clientData?.email ?? "",
    firstName: clientData?.firstName ?? "",
    lastName: clientData?.lastName ?? "",
    phone: clientData?.phone ?? null,
    avatarUrl: clientData?.avatarUrl ?? null,
    firstTouchSource: clientData?.firstTouchSource ?? "DIRECT",
    referralCredit: clientData?.referralCredit ?? 0,
    totalSessionsBooked: clientData?.totalSessionsBooked ?? 0,
  };

  const messages: SerialMessage[] = messagesSnap.docs.map((d) => {
    const m = d.data();
    return {
      id: d.id,
      direction: m.direction === "INBOUND" ? "INBOUND" : "OUTBOUND",
      channel: m.channel ?? "EMAIL",
      subject: m.subject ?? null,
      body: m.body ?? "",
      adminUid: m.adminUid ?? null,
      sentAt: ts(m.sentAt),
      isAutomatic: !!m.isAutomatic,
    };
  });

  const invoices: SerialInvoice[] = invoicesSnap.docs
    .map((d) => {
      const i = d.data();
      return {
        id: d.id,
        projectId: i.projectId,
        clientId: i.clientId,
        type: i.type,
        status: i.status,
        amountCents: i.amountCents ?? 0,
        dueDate: ts(i.dueDate),
        paidAt: ts(i.paidAt),
        sentAt: ts(i.sentAt),
        stripePaymentLinkUrl: i.stripePaymentLinkUrl ?? null,
        createdAt: ts(i.createdAt),
      };
    })
    // Order: DEPOSIT first, then BALANCE, then FULL, then by createdAt
    .sort((a, b) => {
      const order: Record<string, number> = { DEPOSIT: 0, BALANCE: 1, FULL: 2 };
      const oa = order[a.type] ?? 9;
      const ob = order[b.type] ?? 9;
      if (oa !== ob) return oa - ob;
      return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
    });

  let contract: SerialContract | null = null;
  if (!contractsSnap.empty) {
    const c = contractsSnap.docs[0].data();
    contract = {
      id: contractsSnap.docs[0].id,
      projectId: c.projectId,
      clientId: c.clientId,
      status: c.status,
      templateId: c.templateId ?? "",
      renderedHtml: c.renderedHtml ?? "",
      signerIp: c.signerIp ?? null,
      signerUserAgent: c.signerUserAgent ?? null,
      sentAt: ts(c.sentAt),
      signedAt: ts(c.signedAt),
      createdAt: ts(c.createdAt),
    };
  }

  const eventId: string | null = eventsSnap.empty ? null : eventsSnap.docs[0].id;

  return (
    <ProjectWorkspaceClient
      project={project}
      client={client}
      messages={messages}
      invoices={invoices}
      contract={contract}
      eventId={eventId}
      nextBestAction={getNextBestAction(project.status)}
    />
  );
}
