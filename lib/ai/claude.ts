// lib/ai/claude.ts
//
// SERVER-ONLY. Never import from a "use client" component.
//
// Anthropic SDK wrapper for Phase 5.1 + 5.2 of the business dashboard:
//   - draftReply()        Generates a draft email response in Korrin's voice.
//   - summarizeThread()   Summarizes a long conversation thread.
//
// Required env var:
//   ANTHROPIC_API_KEY     (sk-ant-...). Missing → all calls throw on use.
//
// Prompt caching strategy (per @anthropic-ai/sdk best practices):
//   - The system message + voice samples are LARGE and STABLE across calls.
//     We mark them with cache_control: { type: "ephemeral" } so the prefix
//     is cached and re-used at ~0.1x cost on subsequent requests.
//   - The per-call dynamic data (this specific project + this specific
//     thread) lives in the user turn WITHOUT cache_control — it changes
//     every call, so caching would hurt rather than help.
//   - Render order is: tools → system → messages. We put the cached
//     content first inside the system array so the entire prefix caches.

import Anthropic from "@anthropic-ai/sdk";
import type { ClientDoc } from "@/lib/db/clients";
import type { ProjectDoc, MessageDoc } from "@/lib/db/projects";
import { adminDb } from "@/lib/firebase-admin";

// ──────────────────────────────────────────────────────────────────────────
// Singleton client
// ──────────────────────────────────────────────────────────────────────────

const MODEL = "claude-opus-4-7";

type AnthropicLike = Pick<Anthropic, "messages">;

let _client: AnthropicLike | null = null;

function getClient(): AnthropicLike {
  if (_client) return _client;

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[lib/ai/claude] Missing ANTHROPIC_API_KEY. AI features will not work.");
    // Stub that throws on every call — mirrors lib/stripe.ts pattern for STRIPE_SECRET_KEY.
    const stubError = () => {
      throw new Error(
        "ANTHROPIC_API_KEY is not configured. Set it in .env.local (local) or the Vercel project (production) to enable AI features."
      );
    };
    _client = {
      messages: {
        create: stubError,
      } as unknown as Anthropic["messages"],
    };
    return _client;
  }

  _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

// ──────────────────────────────────────────────────────────────────────────
// Brand-voice system prompt (stable — cached)
// ──────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are writing on behalf of Korrin, a photographer (Korrin's Photos).
Match her voice exactly:

- Warm, editorial, and personal — never corporate.
- Lowercase-friendly. Sentence fragments are fine when they fit the rhythm.
- No exclamation marks. None. Use periods and commas to do the work.
- No emojis. No marketing-speak ("exciting opportunity", "elevate your", "we'd love to").
- Short paragraphs. One thought per paragraph.
- Sign off simply when a sign-off is needed: "— korrin" (lowercase, em-dash).
- Speak like a friend who happens to be the photographer. Confident but not pushy.

When writing replies, write only the body of the email. Do not include a subject line.
Do not invent details (dates, prices, locations) you do not have — leave a short
placeholder like [date] or [package price] if you must.`;

// ──────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────

export interface AiUsage {
  input_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  output_tokens: number;
}

export interface AiResult {
  text: string;
  usage?: AiUsage;
}

export interface DraftReplyInput {
  project: ProjectDoc;
  client: ClientDoc;
  thread: MessageDoc[];
  voiceSamples?: string[];
}

export interface SummarizeThreadInput {
  project: ProjectDoc;
  client: ClientDoc;
  thread: MessageDoc[];
}

/**
 * Generate a draft reply to the most-recent inbound message on this project.
 * The system prompt + voice samples are cached; only the current thread
 * varies per call.
 */
export async function draftReply(input: DraftReplyInput): Promise<AiResult> {
  const { project, client, thread, voiceSamples = [] } = input;

  const voiceBlock = formatVoiceSamples(voiceSamples);
  const threadBlock = formatThreadForPrompt(thread);
  const contextBlock = formatProjectContext(project, client);

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
      },
      {
        type: "text",
        text: voiceBlock,
        // Cache the large, stable voice-priming block.
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              `Project context:\n${contextBlock}\n\n` +
              `Conversation so far (most recent last):\n${threadBlock}\n\n` +
              `Write a draft reply from Korrin to the most recent inbound message. ` +
              `Email body only — no subject line, no preamble like "Here's the draft:". ` +
              `If there is no inbound message to respond to, write a warm check-in.`,
          },
        ],
      },
    ],
  });

  return {
    text: extractText(response),
    usage: extractUsage(response),
  };
}

/**
 * Summarize an entire project thread into ~3 short paragraphs that an admin
 * could read at a glance: where the conversation is, what's outstanding, and
 * what (if anything) the client is waiting for.
 */
export async function summarizeThread(input: SummarizeThreadInput): Promise<AiResult> {
  const { project, client, thread } = input;

  const threadBlock = formatThreadForPrompt(thread);
  const contextBlock = formatProjectContext(project, client);

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 600,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        // Cache the stable brand-voice prompt for the summary endpoint too.
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              `Project context:\n${contextBlock}\n\n` +
              `Full conversation thread (oldest first):\n${threadBlock}\n\n` +
              `Summarize this thread in 3 short paragraphs for an admin glance:\n` +
              `1. where the conversation stands right now,\n` +
              `2. what's outstanding or unresolved,\n` +
              `3. what (if anything) the client is currently waiting on from korrin.\n\n` +
              `Be factual and concise. Do not write in the brand voice for the summary itself — ` +
              `write plainly, like an internal note. No greeting, no sign-off.`,
          },
        ],
      },
    ],
  });

  return {
    text: extractText(response),
    usage: extractUsage(response),
  };
}

/**
 * Pulls the most-recent OUTBOUND messages across this admin's projects, to
 * use as voice priming. Best-effort — returns [] on any failure.
 *
 * @param adminUid       Firebase UID of the admin (Korrin).
 * @param limit          How many outbound messages to gather (default 20).
 */
export async function loadVoiceSamples(adminUid: string, limit = 20): Promise<string[]> {
  try {
    const snap = await adminDb
      .collectionGroup("messages")
      .where("direction", "==", "OUTBOUND")
      .where("adminUid", "==", adminUid)
      .orderBy("sentAt", "desc")
      .limit(limit)
      .get();

    return snap.docs
      .map((d) => {
        const data = d.data() as Partial<MessageDoc>;
        return typeof data.body === "string" ? data.body.trim() : "";
      })
      .filter((s) => s.length > 0);
  } catch (err) {
    console.warn("[lib/ai/claude] loadVoiceSamples failed; using empty primer:", err);
    return [];
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────────────────────────────

function formatVoiceSamples(samples: string[]): string {
  if (samples.length === 0) {
    return `Voice samples: (none available yet — rely on the style guidance above).`;
  }
  const trimmed = samples.slice(0, 20).map((s, i) => `--- Sample ${i + 1} ---\n${s}`);
  return `Here are recent messages Korrin has sent, for voice priming. ` +
    `Match their cadence, vocabulary, and rhythm — but do not copy phrases verbatim:\n\n` +
    trimmed.join("\n\n");
}

function formatProjectContext(project: ProjectDoc, client: ClientDoc): string {
  const lines: string[] = [];
  lines.push(`Client: ${client.firstName} ${client.lastName} (${client.email})`);
  lines.push(`Project: ${project.title}`);
  lines.push(`Session type: ${project.sessionType}`);
  lines.push(`Status: ${project.status}`);
  if (project.packageName) lines.push(`Package: ${project.packageName}`);
  if (project.shootLocation?.label) lines.push(`Location: ${project.shootLocation.label}`);
  if (project.notes) lines.push(`Internal notes: ${project.notes}`);
  return lines.join("\n");
}

function formatThreadForPrompt(thread: MessageDoc[]): string {
  if (thread.length === 0) return "(no messages yet)";
  return thread
    .map((m) => {
      const who = m.direction === "INBOUND" ? "CLIENT" : "KORRIN";
      const subject = m.subject ? ` — ${m.subject}` : "";
      return `[${who}${subject}]\n${m.body}`;
    })
    .join("\n\n");
}

type AnthropicMessageResponse = Awaited<ReturnType<Anthropic["messages"]["create"]>>;

function extractText(response: AnthropicMessageResponse): string {
  if (!("content" in response) || !Array.isArray(response.content)) return "";
  const pieces: string[] = [];
  for (const block of response.content) {
    if (block && typeof block === "object" && "type" in block && block.type === "text") {
      const maybeText = (block as { text?: unknown }).text;
      if (typeof maybeText === "string") pieces.push(maybeText);
    }
  }
  return pieces.join("\n").trim();
}

function extractUsage(response: AnthropicMessageResponse): AiUsage | undefined {
  if (!("usage" in response) || !response.usage) return undefined;
  const u = response.usage;
  return {
    input_tokens: u.input_tokens ?? 0,
    cache_creation_input_tokens: u.cache_creation_input_tokens ?? undefined,
    cache_read_input_tokens: u.cache_read_input_tokens ?? undefined,
    output_tokens: u.output_tokens ?? 0,
  };
}
