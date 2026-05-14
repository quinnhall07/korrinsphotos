// lib/search.ts
// Server-only admin search helper for the global command palette.
//
// Firestore has no native substring or full-text search, so we lean on the
// standard prefix trick: `where(field, ">=", q).where(field, "<=", q + "")`.
// `` is the highest valid Unicode code point in the Basic Multilingual
// Plane, so it caps the range cleanly. This gives us case-sensitive prefix
// matches (good enough for an admin tool; full-text would require Algolia).
//
// We run client searches against both `firstName` and `email` in parallel and
// dedupe by id, since users naturally type either.

import { clientsCol, type ClientDoc } from "@/lib/db/clients";
import { projectsCol, type ProjectDoc } from "@/lib/db/projects";
import { eventsCol, type EventDoc } from "@/lib/db/events";

export interface SearchHit {
  id: string;
  label: string;
  sublabel: string;
  href: string;
}

export interface SearchResults {
  clients: SearchHit[];
  projects: SearchHit[];
  events: SearchHit[];
}

const EMPTY: SearchResults = { clients: [], projects: [], events: [] };
const HIGH_UNICODE = ""; // Cap for the prefix-range trick.
const LIMIT = 5;

/**
 * Run a prefix search across clients, projects, and events.
 * Returns at most `LIMIT` hits per collection, with only the fields the
 * command palette needs (no full doc payloads in the network).
 */
export async function searchAdmin(qRaw: string): Promise<SearchResults> {
  const q = qRaw.trim();
  if (q.length < 2) return EMPTY;

  // Prefix range query: field starts with q.
  const end = q + HIGH_UNICODE;

  // Run a few prefix searches in parallel. Each Firestore prefix query
  // requires `>=` and `<=` on the same field.
  const [clientsByFirst, clientsByEmail, projectsByTitle, eventsByTitle] =
    await Promise.all([
      clientsCol()
        .where("firstName", ">=", q)
        .where("firstName", "<=", end)
        .limit(LIMIT)
        .get(),
      clientsCol()
        .where("email", ">=", q)
        .where("email", "<=", end)
        .limit(LIMIT)
        .get(),
      projectsCol()
        .where("title", ">=", q)
        .where("title", "<=", end)
        .limit(LIMIT)
        .get(),
      eventsCol()
        .where("title", ">=", q)
        .where("title", "<=", end)
        .limit(LIMIT)
        .get(),
    ]);

  // Dedupe clients by id (a single doc could match on both firstName and email).
  const clientMap = new Map<string, ClientDoc>();
  for (const snap of [...clientsByFirst.docs, ...clientsByEmail.docs]) {
    if (!clientMap.has(snap.id)) {
      clientMap.set(snap.id, { id: snap.id, ...snap.data() } as ClientDoc);
    }
  }

  const clients: SearchHit[] = Array.from(clientMap.values())
    .slice(0, LIMIT)
    .map((c) => ({
      id: c.id,
      label: `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || c.email,
      sublabel: c.email,
      // Clients don't have a dedicated page yet — link to the pipeline
      // filtered to their first project. For now, deep-link to /admin/users
      // where the universal client record is administered.
      href: `/admin/users?email=${encodeURIComponent(c.email)}`,
    }));

  const projects: SearchHit[] = projectsByTitle.docs.map((d) => {
    const data = d.data() as Omit<ProjectDoc, "id">;
    return {
      id: d.id,
      label: data.title ?? "Untitled project",
      sublabel: data.sessionType ?? "Project",
      href: `/admin/projects/${d.id}`,
    };
  });

  const events: SearchHit[] = eventsByTitle.docs.map((d) => {
    const data = d.data() as Omit<EventDoc, "id">;
    return {
      id: d.id,
      label: data.title ?? "Untitled event",
      sublabel: data.location ?? "Event",
      href: `/admin/events/${d.id}`,
    };
  });

  return { clients, projects, events };
}
