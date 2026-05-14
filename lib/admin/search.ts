// lib/admin/search.ts
// Server-only unified admin search across clients, projects, events,
// vendors, and journal posts. Imported by both the API route at
// /api/admin/search and the page at /admin/search so the page can call it
// directly without a network hop.
//
// Strategy: Firestore has no native full-text search, so each collection is
// queried with the standard prefix-range trick on the most distinguishing
// field, then the same query (or a broader top-N fetch) is filtered in
// memory for substring matches against secondary fields. Caps are tight
// (TOP_N for the broad fetch, RESULT_LIMIT per collection in the response)
// so wall time stays under ~500ms with five collections in parallel.

import { clientsCol, type ClientDoc } from "@/lib/db/clients";
import { projectsCol, type ProjectDoc } from "@/lib/db/projects";
import { eventsCol, type EventDoc } from "@/lib/db/events";
import { vendorsCol, type VendorDoc } from "@/lib/db/vendors";
import {
  journalPostsCol,
  type JournalPostDoc,
} from "@/lib/db/journal-posts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SearchHitKind =
  | "client"
  | "project"
  | "event"
  | "vendor"
  | "journal";

export interface SearchHit {
  id: string;
  label: string;
  sublabel: string;
  href: string;
  kind: SearchHitKind;
}

export interface SearchResults {
  clients: SearchHit[];
  projects: SearchHit[];
  events: SearchHit[];
  vendors: SearchHit[];
  journal: SearchHit[];
}

const EMPTY: SearchResults = {
  clients: [],
  projects: [],
  events: [],
  vendors: [],
  journal: [],
};

// ── Tunables ──────────────────────────────────────────────────────────────────

/** Cap for the prefix-range trick. `` is the highest code point in the
 *  Basic Multilingual Plane, so it bounds the range cleanly. */
const HIGH_UNICODE = "";

/** Max items returned per collection in the response. Keeps the palette
 *  digestible and the JSON small. */
const RESULT_LIMIT = 10;

/** Top-N fetched for in-memory filtering when we need substring (not just
 *  prefix) matches. Tuned so a five-collection fan-out stays under ~500ms. */
const SCAN_LIMIT = 50;

/** Minimum query length. Anything shorter returns immediately — protects
 *  against accidentally scanning the entire collection. */
const MIN_QUERY_LENGTH = 2;

// ── Helpers ───────────────────────────────────────────────────────────────────

function clientLabel(c: ClientDoc): string {
  const name = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
  return name || c.email;
}

function clientHref(c: ClientDoc): string {
  return `/admin/users?email=${encodeURIComponent(c.email)}`;
}

// ── Per-collection searches ───────────────────────────────────────────────────

/**
 * Clients — match on email (Firestore prefix range) OR firstName / lastName
 * (in-memory contains over a top-N fetch). Deduped by id.
 */
async function searchClients(q: string): Promise<SearchHit[]> {
  const end = q + HIGH_UNICODE;
  const [byEmail, scan] = await Promise.all([
    clientsCol()
      .where("email", ">=", q)
      .where("email", "<=", end)
      .limit(RESULT_LIMIT)
      .get(),
    // Broad fetch ordered by recency so the top of the list is fresh.
    clientsCol().orderBy("createdAt", "desc").limit(SCAN_LIMIT).get(),
  ]);

  const map = new Map<string, ClientDoc>();
  for (const d of byEmail.docs) {
    map.set(d.id, { id: d.id, ...d.data() } as ClientDoc);
  }
  for (const d of scan.docs) {
    if (map.has(d.id)) continue;
    const data = { id: d.id, ...d.data() } as ClientDoc;
    const first = (data.firstName ?? "").toLowerCase();
    const last = (data.lastName ?? "").toLowerCase();
    const email = (data.email ?? "").toLowerCase();
    if (first.includes(q) || last.includes(q) || email.includes(q)) {
      map.set(d.id, data);
    }
  }

  return Array.from(map.values())
    .slice(0, RESULT_LIMIT)
    .map((c) => ({
      id: c.id,
      label: clientLabel(c),
      sublabel: c.email,
      href: clientHref(c),
      kind: "client" as const,
    }));
}

/**
 * Projects — match on title (Firestore prefix range) OR the linked
 * client's email / first / last (in-memory contains over a top-N fetch).
 * Project-to-client joins are batched via a single get-by-id pass.
 */
async function searchProjects(q: string): Promise<SearchHit[]> {
  const end = q + HIGH_UNICODE;
  const [byTitle, scan] = await Promise.all([
    projectsCol()
      .where("title", ">=", q)
      .where("title", "<=", end)
      .limit(RESULT_LIMIT)
      .get(),
    projectsCol().orderBy("createdAt", "desc").limit(SCAN_LIMIT).get(),
  ]);

  // Index every candidate so we can decide which need a client-name match.
  const candidates = new Map<string, ProjectDoc>();
  for (const d of byTitle.docs) {
    candidates.set(d.id, { id: d.id, ...d.data() } as ProjectDoc);
  }
  for (const d of scan.docs) {
    if (!candidates.has(d.id)) {
      candidates.set(d.id, { id: d.id, ...d.data() } as ProjectDoc);
    }
  }

  // Collect distinct client ids referenced by candidates, fetch them in one
  // parallel pass, then filter projects whose title OR linked client name /
  // email matches.
  const clientIds = Array.from(
    new Set(
      Array.from(candidates.values())
        .map((p) => p.clientId)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  );

  const clientsById = new Map<string, ClientDoc>();
  if (clientIds.length > 0) {
    const docs = await Promise.all(
      clientIds.map((id) => clientsCol().doc(id).get())
    );
    for (const snap of docs) {
      if (snap.exists) {
        clientsById.set(snap.id, { id: snap.id, ...snap.data() } as ClientDoc);
      }
    }
  }

  const matched: ProjectDoc[] = [];
  for (const p of candidates.values()) {
    const title = (p.title ?? "").toLowerCase();
    if (title.includes(q)) {
      matched.push(p);
      continue;
    }
    const c = clientsById.get(p.clientId);
    if (!c) continue;
    const first = (c.firstName ?? "").toLowerCase();
    const last = (c.lastName ?? "").toLowerCase();
    const email = (c.email ?? "").toLowerCase();
    if (first.includes(q) || last.includes(q) || email.includes(q)) {
      matched.push(p);
    }
  }

  return matched.slice(0, RESULT_LIMIT).map((p) => {
    const c = clientsById.get(p.clientId);
    const sublabel = c
      ? `${clientLabel(c)} · ${p.sessionType ?? "Project"}`
      : p.sessionType ?? "Project";
    return {
      id: p.id,
      label: p.title ?? "Untitled project",
      sublabel,
      href: `/admin/projects/${p.id}`,
      kind: "project" as const,
    };
  });
}

/**
 * Events — match on title. Combines Firestore prefix range with an in-memory
 * substring scan so admins can find an event by a word that appears mid-title.
 */
async function searchEvents(q: string): Promise<SearchHit[]> {
  const end = q + HIGH_UNICODE;
  const [byTitle, scan] = await Promise.all([
    eventsCol()
      .where("title", ">=", q)
      .where("title", "<=", end)
      .limit(RESULT_LIMIT)
      .get(),
    eventsCol().orderBy("createdAt", "desc").limit(SCAN_LIMIT).get(),
  ]);

  const map = new Map<string, EventDoc>();
  for (const d of byTitle.docs) {
    map.set(d.id, { id: d.id, ...d.data() } as EventDoc);
  }
  for (const d of scan.docs) {
    if (map.has(d.id)) continue;
    const data = { id: d.id, ...d.data() } as EventDoc;
    const title = (data.title ?? "").toLowerCase();
    if (title.includes(q)) map.set(d.id, data);
  }

  return Array.from(map.values())
    .slice(0, RESULT_LIMIT)
    .map((e) => ({
      id: e.id,
      label: e.title ?? "Untitled event",
      sublabel: e.location ?? e.clientName ?? "Event",
      href: `/admin/events/${e.id}`,
      kind: "event" as const,
    }));
}

/**
 * Vendors — match on name (Firestore prefix range) OR category (in-memory
 * contains over a top-N fetch).
 */
async function searchVendors(q: string): Promise<SearchHit[]> {
  const end = q + HIGH_UNICODE;
  const [byName, scan] = await Promise.all([
    vendorsCol()
      .where("name", ">=", q)
      .where("name", "<=", end)
      .limit(RESULT_LIMIT)
      .get(),
    vendorsCol().orderBy("createdAt", "desc").limit(SCAN_LIMIT).get(),
  ]);

  const map = new Map<string, VendorDoc>();
  for (const d of byName.docs) {
    map.set(d.id, { id: d.id, ...d.data() } as VendorDoc);
  }
  for (const d of scan.docs) {
    if (map.has(d.id)) continue;
    const data = { id: d.id, ...d.data() } as VendorDoc;
    const name = (data.name ?? "").toLowerCase();
    const category = (data.category ?? "").toLowerCase();
    if (name.includes(q) || category.includes(q)) {
      map.set(d.id, data);
    }
  }

  return Array.from(map.values())
    .slice(0, RESULT_LIMIT)
    .map((v) => ({
      id: v.id,
      label: v.name,
      sublabel: v.city
        ? `${v.category} · ${v.city}`
        : v.category,
      href: `/admin/vendors/${v.id}`,
      kind: "vendor" as const,
    }));
}

/**
 * Journal posts — match on title (in-memory) OR slug (prefix). Slug is
 * URL-safe (lower-case, hyphenated) and unique, so prefix matching is a
 * natural fit for "kelly-and-michael"-style queries.
 */
async function searchJournal(q: string): Promise<SearchHit[]> {
  const end = q + HIGH_UNICODE;
  const [bySlug, scan] = await Promise.all([
    journalPostsCol()
      .where("slug", ">=", q)
      .where("slug", "<=", end)
      .limit(RESULT_LIMIT)
      .get(),
    journalPostsCol().orderBy("createdAt", "desc").limit(SCAN_LIMIT).get(),
  ]);

  const map = new Map<string, JournalPostDoc>();
  for (const d of bySlug.docs) {
    map.set(d.id, { id: d.id, ...d.data() } as JournalPostDoc);
  }
  for (const d of scan.docs) {
    if (map.has(d.id)) continue;
    const data = { id: d.id, ...d.data() } as JournalPostDoc;
    const title = (data.title ?? "").toLowerCase();
    const slug = (data.slug ?? "").toLowerCase();
    if (title.includes(q) || slug.includes(q)) {
      map.set(d.id, data);
    }
  }

  return Array.from(map.values())
    .slice(0, RESULT_LIMIT)
    .map((j) => ({
      id: j.id,
      label: j.title || j.slug,
      sublabel: `${j.status.toLowerCase()} · /journal/${j.slug}`,
      href: `/admin/journal/${j.id}`,
      kind: "journal" as const,
    }));
}

// ── Public entry ──────────────────────────────────────────────────────────────

/**
 * Run a unified admin search across clients, projects, events, vendors,
 * and journal posts. Returns at most `RESULT_LIMIT` hits per collection.
 *
 * Empty / too-short queries return all-empty arrays without hitting the DB.
 * The five collection searches run in parallel via Promise.all to keep
 * overall latency close to that of the slowest single collection.
 */
export async function searchAdminAll(qRaw: string): Promise<SearchResults> {
  const q = qRaw.trim().toLowerCase();
  if (q.length < MIN_QUERY_LENGTH) return EMPTY;

  const [clients, projects, events, vendors, journal] = await Promise.all([
    searchClients(q),
    searchProjects(q),
    searchEvents(q),
    searchVendors(q),
    searchJournal(q),
  ]);

  return { clients, projects, events, vendors, journal };
}
