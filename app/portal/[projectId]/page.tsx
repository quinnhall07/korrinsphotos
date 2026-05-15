// app/portal/[projectId]/page.tsx
// Client-facing project workspace. Mirrors the admin workspace tabs but is
// read-only / client-action-only.
//
// Auth model:
//   1. requireSession() — must be signed in.
//   2. Session email must match clients/{project.clientId}.email.
// ADMIN sessions bypass the email match (so Korrin can preview).
//
// Reads (best-effort fan-out — any individual failure degrades gracefully):
//   - projects/{projectId} + clients/{clientId}
//   - projects/{id}/messages (OUTBOUND/INBOUND — only OUTBOUND surfaced + the client's own INBOUND)
//   - contracts where projectId == id (latest)
//   - invoices where projectId == id
//   - questionnaires where projectId == id
//   - events where projectId == id (first 12 photos via buildCdnUrl)
//   - journalPosts where projectId == id (PUBLISHED only — shown on Inspiration tab)
//   - projects/{id}/dayOfTimeline (subcollection — owned by sibling Agent A3; defensive read)

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase-admin";
import { requireSession } from "@/lib/session";
import { buildCdnUrl } from "@/lib/storage/images";
import { getProject } from "@/lib/db/projects";
import { getClient } from "@/lib/db/clients";
import { PortalClient } from "./PortalClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ projectId: string }> };

export const metadata: Metadata = { title: "Your project | Korrin's Photography" };

// ─── Serialisable shapes ──────────────────────────────────────────────────────

export type PortalProject = {
  id: string;
  status: string;
  sessionType: string;
  title: string;
  shootDate: string | null;
  shootEndDate: string | null;
  shootLocationLabel: string | null;
  packageName: string | null;
  packagePriceUsd: number | null;
  contractSignedAt: string | null;
  depositPaidAt: string | null;
  balancePaidAt: string | null;
  deliveredAt: string | null;
  createdAt: string | null;
};

export type PortalClientShape = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type PortalContract = {
  id: string;
  status: string;
  signingToken: string | null;
  signedAt: string | null;
  sentAt: string | null;
};

export type PortalInvoice = {
  id: string;
  type: string;
  status: string;
  amountCents: number;
  dueDate: string | null;
  paidAt: string | null;
  stripePaymentLinkUrl: string | null;
};

export type PortalQuestionnaire = {
  id: string;
  status: "PENDING" | "COMPLETED" | string;
  sentAt: string | null;
  completedAt: string | null;
};

export type PortalTimelineEntry = {
  id: string;
  startTime: string | null;
  endTime: string | null;
  title: string;
  description: string | null;
  location: string | null;
};

export type PortalGalleryPhoto = {
  id: string;
  thumbnailSrc: string;
  fullSrc: string;
  label: string | null;
};

export type PortalGallery = {
  eventId: string;
  eventTitle: string;
  photos: PortalGalleryPhoto[];
  totalCount: number;
};

export type PortalMessage = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  subject: string | null;
  body: string;
  sentAt: string | null;
  isAutomatic: boolean;
};

export type PortalJournal = {
  slug: string;
  title: string;
  status: string;
};

export type PortalWelcomePacket = {
  url: string;
  generatedAt: string | null;
};

function ts(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in (value as Record<string, unknown>) &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

export default async function PortalProjectPage({ params }: Props) {
  const { projectId } = await params;
  const session = await requireSession();

  // 1. Resolve project + client.
  const project = await getProject(projectId);
  if (!project) {
    redirect("/portal/router");
  }

  const client = await getClient(project.clientId);
  if (!client) {
    redirect("/login?next=/portal/" + encodeURIComponent(projectId));
  }

  // 2. Email-match auth (admins bypass).
  const isAdmin = session.role === "ADMIN";
  const sessionEmail = (session.email ?? "").toLowerCase();
  const clientEmail = (client.email ?? "").toLowerCase();
  if (!isAdmin && sessionEmail !== clientEmail) {
    redirect("/login?next=/portal/" + encodeURIComponent(projectId));
  }

  // 3. Fan-out related artifacts. Each in its own try block so individual
  // failures don't break the page.
  const [contractsSnap, invoicesSnap, questionnairesSnap, eventsSnap, timelineSnap, journalSnap, messagesSnap] =
    await Promise.all([
      adminDb
        .collection("contracts")
        .where("projectId", "==", projectId)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get()
        .catch(() => null),
      adminDb.collection("invoices").where("projectId", "==", projectId).get().catch(() => null),
      adminDb
        .collection("questionnaires")
        .where("projectId", "==", projectId)
        .get()
        .catch(() => null),
      adminDb.collection("events").where("projectId", "==", projectId).limit(1).get().catch(() => null),
      adminDb
        .collection("projects")
        .doc(projectId)
        .collection("dayOfTimeline")
        .orderBy("startTime", "asc")
        .get()
        .catch(() => null),
      adminDb.collection("journalPosts").where("projectId", "==", projectId).limit(1).get().catch(() => null),
      adminDb
        .collection("projects")
        .doc(projectId)
        .collection("messages")
        .orderBy("sentAt", "asc")
        .get()
        .catch(() => null),
    ]);

  // Contract
  let contract: PortalContract | null = null;
  if (contractsSnap && !contractsSnap.empty) {
    const d = contractsSnap.docs[0];
    const c = d.data();
    contract = {
      id: d.id,
      status: c.status,
      signingToken: typeof c.signingToken === "string" ? c.signingToken : null,
      signedAt: ts(c.signedAt),
      sentAt: ts(c.sentAt),
    };
  }

  // Invoices
  const invoices: PortalInvoice[] = invoicesSnap
    ? invoicesSnap.docs
        .map((d) => {
          const i = d.data();
          return {
            id: d.id,
            type: i.type,
            status: i.status,
            amountCents: i.amountCents ?? 0,
            dueDate: ts(i.dueDate),
            paidAt: ts(i.paidAt),
            stripePaymentLinkUrl:
              typeof i.stripePaymentLinkUrl === "string" ? i.stripePaymentLinkUrl : null,
          };
        })
        .sort((a, b) => {
          const order: Record<string, number> = { DEPOSIT: 0, BALANCE: 1, FULL: 2 };
          return (order[a.type] ?? 9) - (order[b.type] ?? 9);
        })
    : [];

  // Questionnaires
  const questionnaires: PortalQuestionnaire[] = questionnairesSnap
    ? questionnairesSnap.docs.map((d) => {
        const q = d.data();
        return {
          id: d.id,
          status: q.status,
          sentAt: ts(q.sentAt),
          completedAt: ts(q.completedAt),
        };
      })
    : [];

  // Day-of timeline (subcollection — agent A3 owns the schema; we read defensively).
  // Filter to client-visible blocks ONLY. Admin-only blocks (vendor notes,
  // off-the-record callouts, internal cues) live in the same subcollection with
  // `visibleToClient: false` and must never leak to the portal.
  const timeline: PortalTimelineEntry[] = timelineSnap
    ? timelineSnap.docs
        .map((d) => {
          const t = d.data();
          return {
            id: d.id,
            startTime: ts(t.startTime),
            endTime: ts(t.endTime),
            title: typeof t.title === "string" ? t.title : "",
            description: typeof t.description === "string" ? t.description : null,
            location: typeof t.location === "string" ? t.location : null,
            __visible: t.visibleToClient !== false,
          };
        })
        .filter((t) => t.__visible)
        .map(({ __visible: _v, ...rest }) => rest)
    : [];

  // Gallery — first 12 ready photos for the linked event.
  let gallery: PortalGallery | null = null;
  if (eventsSnap && !eventsSnap.empty) {
    const eventDoc = eventsSnap.docs[0];
    const eventData = eventDoc.data();
    try {
      const photosSnap = await adminDb
        .collection("events")
        .doc(eventDoc.id)
        .collection("photos")
        .where("galleryReady", "==", true)
        .orderBy("uploadedAt", "asc")
        .limit(12)
        .get();
      const totalSnap = await adminDb
        .collection("events")
        .doc(eventDoc.id)
        .collection("photos")
        .where("galleryReady", "==", true)
        .count()
        .get()
        .catch(() => null);
      const totalCount = totalSnap ? totalSnap.data().count : photosSnap.size;
      gallery = {
        eventId: eventDoc.id,
        eventTitle: typeof eventData.title === "string" ? eventData.title : "Your gallery",
        photos: photosSnap.docs
          .map((d) => {
            const p = d.data();
            if (!p.cloudflareImageId) return null;
            return {
              id: d.id,
              thumbnailSrc: buildCdnUrl(p.cloudflareImageId, "thumbnail"),
              fullSrc: buildCdnUrl(p.cloudflareImageId, "gallery"),
              label: typeof p.label === "string" ? p.label : null,
            } satisfies PortalGalleryPhoto;
          })
          .filter((p): p is PortalGalleryPhoto => !!p),
        totalCount,
      };
    } catch (err) {
      console.error("[portal] gallery preview failed", err);
    }
  }

  // Journal post (published only)
  let journal: PortalJournal | null = null;
  if (journalSnap && !journalSnap.empty) {
    const j = journalSnap.docs[0].data();
    if (j.status === "PUBLISHED" && typeof j.slug === "string") {
      journal = {
        slug: j.slug,
        title: typeof j.title === "string" ? j.title : "Your story",
        status: j.status,
      };
    }
  }

  // Messages — show OUTBOUND (from Korrin to client) and the client's own
  // INBOUND. Skip admin internal noise — we surface every message in the
  // subcollection here since the subcollection only contains client-facing
  // exchanges (admin internal notes live on `projects/{id}.notes`).
  const messages: PortalMessage[] = messagesSnap
    ? messagesSnap.docs.map((d) => {
        const m = d.data();
        return {
          id: d.id,
          direction: m.direction === "INBOUND" ? "INBOUND" : "OUTBOUND",
          subject: typeof m.subject === "string" ? m.subject : null,
          body: typeof m.body === "string" ? m.body : "",
          sentAt: ts(m.sentAt),
          isAutomatic: !!m.isAutomatic,
        };
      })
    : [];

  // Welcome packet — link composed locally so we don't need to import the
  // server domain helper.
  let welcomePacket: PortalWelcomePacket | null = null;
  if (project.welcomePacketToken && project.welcomePacketGeneratedAt) {
    welcomePacket = {
      url: `/welcome-packet/${projectId}?t=${project.welcomePacketToken}`,
      generatedAt: ts(project.welcomePacketGeneratedAt),
    };
  }

  // ─── Serialise for the client component ─────────────────────────────────
  const portalProject: PortalProject = {
    id: project.id,
    status: project.status,
    sessionType: project.sessionType ?? "",
    title: project.title ?? "Your project",
    shootDate: ts(project.shootDate),
    shootEndDate: ts(project.shootEndDate),
    shootLocationLabel: project.shootLocation?.label ?? null,
    packageName: project.packageName ?? null,
    packagePriceUsd: project.packagePriceUsd ?? null,
    contractSignedAt: ts(project.contractSignedAt),
    depositPaidAt: ts(project.depositPaidAt),
    balancePaidAt: ts(project.balancePaidAt),
    deliveredAt: ts(project.deliveredAt),
    createdAt: ts(project.createdAt),
  };

  const portalClient: PortalClientShape = {
    id: client.id,
    email: client.email,
    firstName: client.firstName ?? "",
    lastName: client.lastName ?? "",
  };

  return (
    <PortalClient
      project={portalProject}
      client={portalClient}
      contract={contract}
      invoices={invoices}
      questionnaires={questionnaires}
      timeline={timeline}
      gallery={gallery}
      journal={journal}
      messages={messages}
      welcomePacket={welcomePacket}
    />
  );
}
