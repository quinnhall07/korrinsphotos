import type { Metadata } from "next";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import { ProjectsPipelineClientPage } from "./ProjectsPipelineClientPage";
import { formatDateTime, toDate } from "@/lib/date";
import {
  listProjectsPaginated,
  type ProjectDoc,
  type ProjectStatus,
} from "@/lib/db/projects";

export const metadata: Metadata = { title: "Pipeline | Admin" };
export const dynamic = "force-dynamic";

const TABLE_PAGE_SIZE = 50;

// Closed set of valid pipeline statuses — used to validate `?status=` query
// strings before passing them to the Firestore `where("status", "in", …)`
// filter. Anything not in this set is dropped silently.
const VALID_STATUSES: ReadonlySet<ProjectStatus> = new Set<ProjectStatus>([
  "SITE_VISIT",
  "INQUIRY",
  "QUALIFYING",
  "PROPOSAL_SENT",
  "NEGOTIATING",
  "CONTRACT_SENT",
  "DEPOSIT_PENDING",
  "BOOKED",
  "SHOOT_READY",
  "IN_EDITING",
  "GALLERY_DELIVERED",
  "REFERRAL_SENT",
  "COMPLETED",
  "LOST",
  "ARCHIVED",
]);

type PipelineProjectRow = {
  id: string;
  clientId: string;
  firstName: string;
  lastName: string;
  email: string;
  sessionType: string;
  title: string;
  status: string;
  leadScore: number;
  estimatedValue: number | null;
  createdAt: string;
  lastStatusChangeIso: string | null;
  shootDateIso: string | null;
  lastContactedIso: string | null;
  deliveredAtIso: string | null;
  editingSubStage: string | null;
  depositPaidAtIso: string | null;
  lastRespondedAtIso: string | null;
  coiRequired: boolean;
  coiStatus: "NONE" | "REQUESTED" | "RECEIVED" | "EXPIRED";
};

/**
 * Hydrate a project row + its client join into the serialisable shape the
 * client component expects. Shared by both the full read (Kanban) and the
 * paginated read (table).
 */
function hydrateRow(
  doc: { id: string; data: FirebaseFirestore.DocumentData } | ProjectDoc,
  clientsData: Record<string, FirebaseFirestore.DocumentData>
): PipelineProjectRow {
  // Allow both raw QueryDocumentSnapshot-shaped input and already-typed
  // ProjectDoc input — the snapshot path keeps backwards compat with the
  // existing Kanban hydration; the typed path is what `listProjectsPaginated`
  // returns.
  const data: FirebaseFirestore.DocumentData =
    "data" in doc && typeof doc.data === "object"
      ? (doc.data as FirebaseFirestore.DocumentData)
      : (doc as unknown as FirebaseFirestore.DocumentData);
  const id = doc.id;
  const client = clientsData[data.clientId as string] || {};

  // Derive the most-recent status-change timestamp from statusHistory.
  // Fallback to createdAt if statusHistory is missing/empty.
  let lastStatusChangeIso: string | null = null;
  const history = Array.isArray(data.statusHistory) ? data.statusHistory : [];
  if (history.length > 0) {
    const last = history[history.length - 1];
    const d = toDate(last?.at);
    if (d) lastStatusChangeIso = d.toISOString();
  }
  if (!lastStatusChangeIso) {
    const created = toDate(data.createdAt);
    if (created) lastStatusChangeIso = created.toISOString();
  }

  const shoot = toDate(data.shootDate);
  const shootDateIso = shoot ? shoot.toISOString() : null;
  const lastContacted = toDate(data.lastContactedAt);
  const lastContactedIso = lastContacted ? lastContacted.toISOString() : null;
  const deliveredAt = toDate(data.deliveredAt);
  const deliveredAtIso = deliveredAt ? deliveredAt.toISOString() : null;
  const editingSubStage =
    typeof data.editingSubStage === "string" ? data.editingSubStage : null;
  const depositPaidAt = toDate(data.depositPaidAt);
  const depositPaidAtIso = depositPaidAt ? depositPaidAt.toISOString() : null;
  const lastResponded = toDate(data.lastRespondedAt);
  const lastRespondedAtIso = lastResponded ? lastResponded.toISOString() : null;

  const coiRequired = !!data.coiRequired;
  const rawCoiStatus =
    typeof data.coiStatus === "string" ? data.coiStatus : "NONE";
  const coiStatus: "NONE" | "REQUESTED" | "RECEIVED" | "EXPIRED" =
    rawCoiStatus === "REQUESTED" ||
    rawCoiStatus === "RECEIVED" ||
    rawCoiStatus === "EXPIRED"
      ? rawCoiStatus
      : "NONE";

  return {
    id,
    clientId: String(data.clientId ?? ""),
    firstName: String(client.firstName ?? "Unknown"),
    lastName: String(client.lastName ?? ""),
    email: String(client.email ?? ""),
    sessionType: String(data.sessionType ?? ""),
    title: String(data.title ?? ""),
    status: String(data.status ?? "INQUIRY"),
    leadScore: Number(data.leadScore ?? 0),
    estimatedValue: data.estimatedValue ?? null,
    createdAt: formatDateTime(data.createdAt) ?? "Unknown",
    lastStatusChangeIso,
    shootDateIso,
    lastContactedIso,
    deliveredAtIso,
    editingSubStage,
    depositPaidAtIso,
    lastRespondedAtIso,
    coiRequired,
    coiStatus,
  };
}

async function loadClientsMap(): Promise<
  Record<string, FirebaseFirestore.DocumentData>
> {
  const clientsData: Record<string, FirebaseFirestore.DocumentData> = {};
  const clientsSnap = await adminDb.collection("clients").get();
  clientsSnap.docs.forEach((doc) => {
    clientsData[doc.id] = doc.data();
  });
  return clientsData;
}

/**
 * Kanban path — full collection read. Columns are inherently capped by status
 * so the cardinality concern that drove paginating the table view does not
 * apply here.
 */
async function getProjectsFull(): Promise<PipelineProjectRow[]> {
  const projectsSnap = await adminDb
    .collection("projects")
    .orderBy("createdAt", "desc")
    .get();
  const clientsData = await loadClientsMap();
  return projectsSnap.docs.map((doc) =>
    hydrateRow({ id: doc.id, data: doc.data() }, clientsData)
  );
}

/**
 * Table path — cursor-paginated. Default sort is `updatedAt desc` so the
 * most-recently-touched projects surface first.
 */
async function getProjectsPage(opts: {
  cursor: string | null;
  statusFilter: ProjectStatus[] | undefined;
}): Promise<{ rows: PipelineProjectRow[]; nextCursor: string | null }> {
  const page = await listProjectsPaginated({
    pageSize: TABLE_PAGE_SIZE,
    cursor: opts.cursor,
    statusFilter: opts.statusFilter,
  });
  const clientsData = await loadClientsMap();
  const rows = page.projects.map((p) =>
    hydrateRow(p as ProjectDoc, clientsData)
  );
  return { rows, nextCursor: page.nextCursor };
}

export default async function AdminProjectsPage(props: {
  searchParams: Promise<{
    cursor?: string;
    view?: "kanban" | "table";
    status?: string;
  }>;
}) {
  await requireAdmin();
  const { cursor, view, status } = await props.searchParams;

  // Default view is kanban (matches the historic UX). Only when `view=table`
  // is explicitly set do we switch to the paginated read.
  const resolvedView: "kanban" | "table" = view === "table" ? "table" : "kanban";

  // Parse `?status=A,B,C` into a validated, deduplicated list of pipeline
  // statuses. Anything not in `VALID_STATUSES` is dropped silently so a
  // malformed query string never crashes the page or sneaks a raw value into
  // the Firestore query.
  const statusFilter: ProjectStatus[] | undefined = (() => {
    if (!status) return undefined;
    const seen = new Set<ProjectStatus>();
    for (const raw of status.split(",")) {
      const trimmed = raw.trim().toUpperCase();
      if (VALID_STATUSES.has(trimmed as ProjectStatus)) {
        seen.add(trimmed as ProjectStatus);
      }
    }
    return seen.size > 0 ? Array.from(seen) : undefined;
  })();

  let projects: PipelineProjectRow[];
  let nextCursor: string | null = null;
  if (resolvedView === "table") {
    const page = await getProjectsPage({
      cursor: cursor ?? null,
      statusFilter,
    });
    projects = page.rows;
    nextCursor = page.nextCursor;
  } else {
    projects = await getProjectsFull();
  }

  return (
    <ProjectsPipelineClientPage
      projects={projects}
      view={resolvedView}
      nextCursor={nextCursor}
      hasCursor={Boolean(cursor)}
      statusFilterParam={status ?? null}
      pageSize={TABLE_PAGE_SIZE}
    />
  );
}
