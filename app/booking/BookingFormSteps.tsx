"use client";

// app/booking/BookingFormSteps.tsx
// Multi-step booking inquiry form.
//
// Flow:
//   Step 1 — Session type (tile picker) + tentative month picker.
//   Step 2 — Location bucket + mood quiz + optional message.
//   Step 3 — Contact details + referral source + soft commitment checkbox.
//
// On submit, all fields are forwarded to the existing `submitBooking`
// Server Action via FormData. Dual-write semantics (clients + projects +
// bookingInquiries) are preserved server-side — this component does not
// touch the DB directly.
//
// Persistence: progress is mirrored to localStorage under
// `korrin-booking-draft` on every change. Cleared on successful submit.
//
// Style: inline styles consistent with the rest of the public site.
// Cormorant Garamond for headings; Jost for body + form controls.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { submitBooking } from "./actions";

// ─── Types ─────────────────────────────────────────────────────────────────

type SessionType =
  | "Portrait"
  | "Engagement"
  | "Wedding"
  | "Family"
  | "Editorial"
  | "Commercial";

type LocationLabel =
  | "Cary / Raleigh-Durham area"
  | "North Carolina"
  | "I'll travel — somewhere else";

type MoodTag =
  | "light-airy"
  | "dark-moody"
  | "editorial"
  | "documentary"
  | "bold-cinematic";

type ReferralSource =
  | "Website"
  | "Instagram"
  | "Google"
  | "Referral"
  | "Other";

interface Draft {
  sessionType: SessionType | "";
  preferredMonth: string;          // "" | "not-sure" | "YYYY-MM"
  locationLabel: LocationLabel | "";
  locationDetail: string;
  moodTag: MoodTag | "";
  message: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  referralSource: ReferralSource;
  readProcessPage: boolean;
}

const DRAFT_KEY = "korrin-booking-draft";

const EMPTY_DRAFT: Draft = {
  sessionType: "",
  preferredMonth: "not-sure",
  locationLabel: "",
  locationDetail: "",
  moodTag: "",
  message: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  referralSource: "Website",
  readProcessPage: false,
};

// ─── Static data ───────────────────────────────────────────────────────────

const SESSION_TILES: {
  value: SessionType;
  eyebrow: string;
  title: string;
  subtext: string;
}[] = [
  {
    value: "Portrait",
    eyebrow: "Solo",
    title: "Portrait",
    subtext: "1–2 hour studio or location session",
  },
  {
    value: "Engagement",
    eyebrow: "Two of you",
    title: "Engagement",
    subtext: "Golden-hour story, 1.5 hours",
  },
  {
    value: "Wedding",
    eyebrow: "The day",
    title: "Wedding",
    subtext: "Full-day editorial coverage",
  },
  {
    value: "Family",
    eyebrow: "Together",
    title: "Family",
    subtext: "Outdoor or in-home, relaxed pace",
  },
  {
    value: "Editorial",
    eyebrow: "Concept",
    title: "Editorial",
    subtext: "Magazine-style narrative shoot",
  },
  {
    value: "Commercial",
    eyebrow: "Brand",
    title: "Commercial",
    subtext: "Product, lifestyle, or campaign",
  },
];

const MOOD_TILES: { value: MoodTag; title: string; subtext: string }[] = [
  {
    value: "light-airy",
    title: "Light & Airy",
    subtext: "Soft, sunlit, romantic",
  },
  {
    value: "dark-moody",
    title: "Dark & Moody",
    subtext: "Rich shadows, painterly tone",
  },
  {
    value: "editorial",
    title: "Editorial / Magazine",
    subtext: "Styled, intentional, refined",
  },
  {
    value: "documentary",
    title: "Documentary / Candid",
    subtext: "Unposed, real moments",
  },
  {
    value: "bold-cinematic",
    title: "Bold & Cinematic",
    subtext: "Filmic, high-contrast, dramatic",
  },
];

// ─── Style primitives ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "0.5px solid var(--border-strong)",
  background: "transparent",
  padding: "0.85rem 1rem",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.92rem",
  color: "var(--charcoal)",
  outline: "none",
  borderRadius: 0,
  appearance: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.68rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--charcoal-muted)",
  marginBottom: "0.5rem",
};

const stepEyebrowStyle: React.CSSProperties = {
  fontSize: "0.65rem",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--olive)",
  marginBottom: "0.75rem",
};

const stepHeadingStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: "1.85rem",
  fontWeight: 300,
  lineHeight: 1.2,
  color: "var(--charcoal)",
  marginBottom: "1.75rem",
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function loadDraft(): Draft {
  if (typeof window === "undefined") return EMPTY_DRAFT;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return EMPTY_DRAFT;
    const parsed = JSON.parse(raw) as Partial<Draft>;
    return { ...EMPTY_DRAFT, ...parsed };
  } catch {
    return EMPTY_DRAFT;
  }
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Build a 24-month rolling list of {value, label} options. */
function buildMonthOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const month = String(d.getMonth() + 1).padStart(2, "0");
    out.push({ value: `${d.getFullYear()}-${month}`, label: fmt.format(d) });
  }
  return out;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function BookingFormSteps() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const topRef = useRef<HTMLDivElement | null>(null);

  // Rehydrate from localStorage on mount.
  useEffect(() => {
    setDraft(loadDraft());
    setHydrated(true);
  }, []);

  // Persist on every change, but only after hydration so we don't overwrite
  // existing draft with the empty default on first render.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore quota / privacy mode errors
    }
  }, [draft, hydrated]);

  // Scroll the form into view on step change (small ergonomic win on mobile).
  useEffect(() => {
    if (!hydrated) return;
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step, hydrated]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  // ─── Per-step validation ─────────────────────────────────────────────────
  const step1Valid = draft.sessionType !== "";
  const step3Valid =
    draft.firstName.trim().length > 0 &&
    draft.lastName.trim().length > 0 &&
    isValidEmail(draft.email);

  // ─── Submit ──────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!step3Valid) {
      setError("Please fill in your name and a valid email address.");
      return;
    }

    const fd = new FormData();
    fd.set("firstName", draft.firstName.trim());
    fd.set("lastName", draft.lastName.trim());
    fd.set("email", draft.email.trim());
    fd.set("sessionType", draft.sessionType);
    // Build a single message body from the optional textarea + a short
    // synthesized summary so the server-side 10-char minimum is met even
    // when the user leaves the textarea empty.
    const summaryLines: string[] = [];
    if (draft.preferredMonth && draft.preferredMonth !== "not-sure") {
      const m = monthOptions.find((o) => o.value === draft.preferredMonth);
      summaryLines.push(`Tentative month: ${m?.label ?? draft.preferredMonth}`);
    } else {
      summaryLines.push("Tentative month: Not sure yet");
    }
    if (draft.locationLabel) summaryLines.push(`Location: ${draft.locationLabel}`);
    if (draft.locationDetail.trim()) {
      summaryLines.push(`City / venue: ${draft.locationDetail.trim()}`);
    }
    if (draft.moodTag) {
      const mood = MOOD_TILES.find((m) => m.value === draft.moodTag);
      summaryLines.push(`Mood: ${mood?.title ?? draft.moodTag}`);
    }
    const userMessage = draft.message.trim();
    const messageBody =
      (userMessage ? `${userMessage}\n\n— — —\n` : "") + summaryLines.join("\n");
    fd.set("message", messageBody);

    if (draft.preferredMonth && draft.preferredMonth !== "not-sure") {
      fd.set("preferredMonth", draft.preferredMonth);
    }
    if (draft.locationLabel) fd.set("locationLabel", draft.locationLabel);
    if (draft.locationDetail.trim()) fd.set("locationDetail", draft.locationDetail.trim());
    if (draft.moodTag) fd.set("moodTag", draft.moodTag);
    if (draft.phone.trim()) fd.set("phone", draft.phone.trim());
    fd.set("referralSource", draft.referralSource);

    startTransition(async () => {
      const result = await submitBooking(fd);
      if (result.success) {
        try {
          window.localStorage.removeItem(DRAFT_KEY);
        } catch {
          // ignore
        }
        setSuccess(true);
      } else {
        setError(result.error ?? "Something went wrong. Please try again.");
      }
    });
  }

  // ─── Success ─────────────────────────────────────────────────────────────
  if (success) {
    return (
      <div
        style={{
          border: "0.5px solid var(--border-strong)",
          padding: "2.5rem",
          background: "var(--olive-dim)",
          borderLeft: "2px solid var(--olive)",
        }}
      >
        <p style={stepEyebrowStyle}>Inquiry Received</p>
        <h2
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "2.2rem",
            fontWeight: 300,
            lineHeight: 1.2,
            color: "var(--charcoal)",
            marginBottom: "1rem",
          }}
        >
          We got it.
        </h2>
        <p
          style={{
            fontSize: "0.92rem",
            color: "var(--charcoal-light)",
            lineHeight: 1.75,
            marginBottom: "1.75rem",
          }}
        >
          A confirmation is on its way to your inbox. Here is what happens next.
        </p>

        <ol
          style={{
            listStyle: "none",
            counterReset: "step",
            margin: 0,
            padding: 0,
          }}
        >
          {[
            "Korrin reviews your inquiry personally — usually within 48 hours.",
            "She replies with availability, a tailored package, and any clarifying questions.",
            "Once you align, a contract and deposit invoice land in your inbox to lock the date.",
          ].map((line, i) => (
            <li
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "1rem",
                alignItems: "baseline",
                padding: "0.85rem 0",
                borderTop: i === 0 ? "0.5px solid var(--border)" : "none",
                borderBottom: "0.5px solid var(--border)",
              }}
            >
              <span
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "1.4rem",
                  fontWeight: 300,
                  color: "var(--olive)",
                  fontStyle: "italic",
                  minWidth: "1.5rem",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                style={{
                  fontSize: "0.92rem",
                  color: "var(--charcoal-light)",
                  lineHeight: 1.7,
                }}
              >
                {line}
              </span>
            </li>
          ))}
        </ol>

        <p
          style={{
            marginTop: "1.75rem",
            fontSize: "0.88rem",
            color: "var(--charcoal-muted)",
            lineHeight: 1.7,
          }}
        >
          While you wait, browse the{" "}
          <Link
            href="/portfolio"
            style={{
              color: "var(--olive)",
              textDecoration: "underline",
              textUnderlineOffset: "3px",
            }}
          >
            portfolio
          </Link>
          .
        </p>
      </div>
    );
  }

  // ─── Step renderers ──────────────────────────────────────────────────────
  return (
    <div ref={topRef}>
      <ProgressBar step={step} />

      <form onSubmit={handleSubmit} noValidate>
        {step === 1 && (
          <Step1
            draft={draft}
            update={update}
            monthOptions={monthOptions}
          />
        )}
        {step === 2 && <Step2 draft={draft} update={update} />}
        {step === 3 && <Step3 draft={draft} update={update} />}

        {error && (
          <p
            style={{
              color: "#B45309",
              fontSize: "0.82rem",
              marginTop: "1.25rem",
            }}
            role="alert"
          >
            {error}
          </p>
        )}

        <StepNav
          step={step}
          isPending={isPending}
          canAdvance={step === 1 ? step1Valid : step === 3 ? step3Valid : true}
          onBack={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
          onNext={() => setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s))}
        />
      </form>
    </div>
  );
}

// ─── Progress Bar ──────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: 1 | 2 | 3 }) {
  const headings = ["What kind of session?", "Where and what vibe?", "Your details"];
  return (
    <div style={{ marginBottom: "2.25rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "0.65rem",
        }}
      >
        <p
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
          }}
        >
          Step {step} of 3
        </p>
        <p
          style={{
            fontSize: "0.72rem",
            letterSpacing: "0.05em",
            color: "var(--charcoal-muted)",
            fontStyle: "italic",
            fontFamily: "'Cormorant Garamond', serif",
          }}
        >
          {headings[step - 1]}
        </p>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "0.5rem",
        }}
      >
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            style={{
              height: "2px",
              background:
                n <= step ? "var(--olive)" : "rgba(42,42,40,0.18)",
              transition: "background var(--transition)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Step 1 ────────────────────────────────────────────────────────────────

function Step1({
  draft,
  update,
  monthOptions,
}: {
  draft: Draft;
  update: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
  monthOptions: { value: string; label: string }[];
}) {
  return (
    <div>
      <p style={stepEyebrowStyle}>Step One</p>
      <h2 style={stepHeadingStyle}>
        What kind of <em style={{ fontStyle: "italic" }}>session</em>?
      </h2>

      <div className="booking-tile-grid-3" style={{ marginBottom: "2rem" }}>
        {SESSION_TILES.map((tile) => {
          const selected = draft.sessionType === tile.value;
          return (
            <button
              type="button"
              key={tile.value}
              onClick={() => update("sessionType", tile.value)}
              style={tileStyle(selected)}
              aria-pressed={selected}
            >
              <span
                style={{
                  fontSize: "0.6rem",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: selected ? "var(--olive)" : "var(--charcoal-muted)",
                  marginBottom: "0.6rem",
                  display: "block",
                }}
              >
                {tile.eyebrow}
              </span>
              <span
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "1.45rem",
                  fontWeight: 300,
                  color: "var(--charcoal)",
                  lineHeight: 1.2,
                  display: "block",
                  marginBottom: "0.4rem",
                }}
              >
                {tile.title}
              </span>
              <span
                style={{
                  fontSize: "0.8rem",
                  color: "var(--charcoal-muted)",
                  lineHeight: 1.55,
                  display: "block",
                }}
              >
                {tile.subtext}
              </span>
            </button>
          );
        })}
      </div>

      <div>
        <label style={labelStyle} htmlFor="preferredMonth">
          When are you thinking?
        </label>
        <select
          id="preferredMonth"
          value={draft.preferredMonth}
          onChange={(e) => update("preferredMonth", e.target.value)}
          style={inputStyle}
        >
          <option value="not-sure">Not sure yet</option>
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <p
          style={{
            fontSize: "0.78rem",
            color: "var(--charcoal-muted)",
            marginTop: "0.6rem",
            lineHeight: 1.55,
            fontStyle: "italic",
          }}
        >
          We&apos;ll lock in the exact date together once we&apos;ve talked
          through your vision.
        </p>
      </div>
    </div>
  );
}

// ─── Step 2 ────────────────────────────────────────────────────────────────

function Step2({
  draft,
  update,
}: {
  draft: Draft;
  update: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
}) {
  const charsLeft = 1000 - draft.message.length;
  return (
    <div>
      <p style={stepEyebrowStyle}>Step Two</p>
      <h2 style={stepHeadingStyle}>
        Where and what <em style={{ fontStyle: "italic" }}>vibe</em>?
      </h2>

      <div style={{ marginBottom: "1.75rem" }}>
        <label style={labelStyle} htmlFor="locationLabel">
          Location
        </label>
        <select
          id="locationLabel"
          value={draft.locationLabel}
          onChange={(e) =>
            update("locationLabel", e.target.value as Draft["locationLabel"])
          }
          style={inputStyle}
        >
          <option value="">Select a location</option>
          <option value="Cary / Raleigh-Durham area">
            Cary / Raleigh-Durham area
          </option>
          <option value="North Carolina">North Carolina</option>
          <option value="I'll travel — somewhere else">
            I&apos;ll travel — somewhere else
          </option>
        </select>
      </div>

      <div style={{ marginBottom: "2rem" }}>
        <label style={labelStyle} htmlFor="locationDetail">
          City or venue (optional)
        </label>
        <input
          id="locationDetail"
          type="text"
          value={draft.locationDetail}
          onChange={(e) => update("locationDetail", e.target.value)}
          placeholder="e.g. Umstead Park, The Bradford"
          style={inputStyle}
          maxLength={200}
        />
      </div>

      <p style={{ ...labelStyle, marginBottom: "0.75rem" }}>
        What mood are you drawn to?
      </p>
      <div className="booking-tile-grid-mood" style={{ marginBottom: "2rem" }}>
        {MOOD_TILES.map((mood) => {
          const selected = draft.moodTag === mood.value;
          return (
            <button
              type="button"
              key={mood.value}
              onClick={() => update("moodTag", mood.value)}
              style={tileStyle(selected)}
              aria-pressed={selected}
            >
              <span
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "1.25rem",
                  fontWeight: 300,
                  color: "var(--charcoal)",
                  lineHeight: 1.2,
                  display: "block",
                  marginBottom: "0.4rem",
                }}
              >
                {mood.title}
              </span>
              <span
                style={{
                  fontSize: "0.78rem",
                  color: "var(--charcoal-muted)",
                  lineHeight: 1.55,
                  display: "block",
                }}
              >
                {mood.subtext}
              </span>
            </button>
          );
        })}
      </div>

      <div>
        <label style={labelStyle} htmlFor="message">
          Anything specific I should know? (optional)
        </label>
        <textarea
          id="message"
          value={draft.message}
          onChange={(e) =>
            update("message", e.target.value.slice(0, 1000))
          }
          placeholder="Ideas, references, must-have shots, special requests…"
          style={{
            ...inputStyle,
            resize: "vertical",
            minHeight: "120px",
            lineHeight: 1.7,
          }}
          maxLength={1000}
        />
        <p
          style={{
            fontSize: "0.72rem",
            color: "var(--charcoal-muted)",
            marginTop: "0.45rem",
            textAlign: "right",
          }}
        >
          {charsLeft} characters left
        </p>
      </div>
    </div>
  );
}

// ─── Step 3 ────────────────────────────────────────────────────────────────

function Step3({
  draft,
  update,
}: {
  draft: Draft;
  update: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
}) {
  return (
    <div>
      <p style={stepEyebrowStyle}>Step Three</p>
      <h2 style={stepHeadingStyle}>
        Your <em style={{ fontStyle: "italic" }}>details</em>
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          marginBottom: "1.6rem",
        }}
        className="booking-name-row"
      >
        <div>
          <label style={labelStyle} htmlFor="firstName">First Name</label>
          <input
            id="firstName"
            type="text"
            required
            value={draft.firstName}
            onChange={(e) => update("firstName", e.target.value)}
            style={inputStyle}
            placeholder="Jane"
          />
        </div>
        <div>
          <label style={labelStyle} htmlFor="lastName">Last Name</label>
          <input
            id="lastName"
            type="text"
            required
            value={draft.lastName}
            onChange={(e) => update("lastName", e.target.value)}
            style={inputStyle}
            placeholder="Doe"
          />
        </div>
      </div>

      <div style={{ marginBottom: "1.6rem" }}>
        <label style={labelStyle} htmlFor="email">Email Address</label>
        <input
          id="email"
          type="email"
          required
          value={draft.email}
          onChange={(e) => update("email", e.target.value)}
          style={inputStyle}
          placeholder="jane@example.com"
        />
      </div>

      <div style={{ marginBottom: "1.6rem" }}>
        <label style={labelStyle} htmlFor="phone">Phone (optional)</label>
        <input
          id="phone"
          type="tel"
          value={draft.phone}
          onChange={(e) => update("phone", e.target.value)}
          style={inputStyle}
          placeholder="(555) 555-0100"
          maxLength={40}
        />
      </div>

      <div style={{ marginBottom: "1.75rem" }}>
        <label style={labelStyle} htmlFor="referralSource">
          How did you hear about me?
        </label>
        <select
          id="referralSource"
          value={draft.referralSource}
          onChange={(e) =>
            update("referralSource", e.target.value as ReferralSource)
          }
          style={inputStyle}
        >
          <option value="Website">Website</option>
          <option value="Instagram">Instagram</option>
          <option value="Google">Google</option>
          <option value="Referral">Referral</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.75rem",
          fontSize: "0.85rem",
          color: "var(--charcoal-light)",
          lineHeight: 1.6,
          cursor: "pointer",
          padding: "0.85rem 0",
          borderTop: "0.5px solid var(--border)",
          borderBottom: "0.5px solid var(--border)",
        }}
      >
        <input
          type="checkbox"
          checked={draft.readProcessPage}
          onChange={(e) => update("readProcessPage", e.target.checked)}
          style={{
            marginTop: "0.2rem",
            accentColor: "var(--olive)",
            width: "14px",
            height: "14px",
            flexShrink: 0,
          }}
        />
        <span>
          I&apos;ve read the{" "}
          <Link
            href="/investment"
            style={{
              color: "var(--olive)",
              textDecoration: "underline",
              textUnderlineOffset: "3px",
            }}
          >
            process
          </Link>{" "}
          page.
        </span>
      </label>
    </div>
  );
}

// ─── Step Navigation ───────────────────────────────────────────────────────

function StepNav({
  step,
  isPending,
  canAdvance,
  onBack,
  onNext,
}: {
  step: 1 | 2 | 3;
  isPending: boolean;
  canAdvance: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const showBack = step > 1;
  const isFinal = step === 3;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: showBack ? "auto 1fr" : "1fr",
        gap: "1rem",
        marginTop: "2.25rem",
      }}
    >
      {showBack && (
        <button
          type="button"
          onClick={onBack}
          disabled={isPending}
          style={{
            padding: "0.85rem 1.6rem",
            fontSize: "0.72rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            background: "transparent",
            color: "var(--charcoal)",
            border: "0.5px solid var(--border-strong)",
            cursor: isPending ? "not-allowed" : "pointer",
            fontFamily: "'Jost', sans-serif",
            transition: "border-color 0.2s, color 0.2s",
          }}
        >
          Back
        </button>
      )}
      {isFinal ? (
        <button
          type="submit"
          disabled={isPending || !canAdvance}
          style={{
            padding: "0.85rem 2.2rem",
            fontSize: "0.72rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            background:
              isPending || !canAdvance
                ? "var(--charcoal-muted)"
                : "var(--olive)",
            color: "var(--white)",
            border: "none",
            cursor:
              isPending || !canAdvance ? "not-allowed" : "pointer",
            fontFamily: "'Jost', sans-serif",
            transition: "background 0.25s",
          }}
        >
          {isPending ? "Sending…" : "Send Inquiry"}
        </button>
      ) : (
        <button
          type="button"
          onClick={onNext}
          disabled={!canAdvance}
          style={{
            padding: "0.85rem 2.2rem",
            fontSize: "0.72rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            background: canAdvance ? "var(--olive)" : "var(--charcoal-muted)",
            color: "var(--white)",
            border: "none",
            cursor: canAdvance ? "pointer" : "not-allowed",
            fontFamily: "'Jost', sans-serif",
            transition: "background 0.25s",
          }}
        >
          Next
        </button>
      )}
    </div>
  );
}

// ─── Tile Style ────────────────────────────────────────────────────────────

function tileStyle(selected: boolean): React.CSSProperties {
  return {
    textAlign: "left",
    padding: "1.25rem 1.15rem",
    background: selected ? "var(--olive-dim)" : "transparent",
    border: selected
      ? "0.5px solid var(--olive)"
      : "0.5px solid var(--border-strong)",
    borderLeft: selected
      ? "2px solid var(--olive)"
      : "0.5px solid var(--border-strong)",
    color: "var(--charcoal)",
    fontFamily: "'Jost', sans-serif",
    cursor: "pointer",
    borderRadius: 0,
    transition: "background 0.2s, border-color 0.2s",
    width: "100%",
    display: "block",
  };
}
