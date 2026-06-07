"use client";

// app/booking/BookingFormSteps.tsx
// Multi-step booking inquiry wizard (4 steps).
//
// Flow:
//   Step 1 — Session type (tile picker) + tentative month + soft commitment.
//   Step 2 — Location bucket + city/venue + mood quiz.
//   Step 3 — Optional message + contact details + referral source.
//   Step 4 — Review every answer (with inline "Edit" jumps) + submit.
//
// On submit, all fields are forwarded to the existing `submitBooking`
// Server Action via FormData. The FormData shape is identical to the
// previous 3-step form — the only thing that changed here is the client UX.
// Persistence (clients + projects + first inbound message + inbox item +
// auto-responder) is handled server-side; this component does not touch
// the DB directly.
//
// Persistence: progress is mirrored to localStorage under
// `korrin-booking-draft` on every change. Cleared on successful submit.
//
// Prefill: reads ?package=, ?sessionType=, ?campaign= from the URL via
// useSearchParams(), so this component can be embedded anywhere (including
// as a BOOKING_FORM section on the site-editor canvas) without prop drilling.
//
// Style: inline styles consistent with the rest of the public site.
// Cormorant Garamond for headings; Jost for body + form controls.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { submitBooking } from "./actions";
import { findPackageById } from "@/app/investment/packages";

// ─── Types ─────────────────────────────────────────────────────────────────

type SessionType =
  | "Portrait"
  | "Family"
  | "Greek-life event";

type ReferralSource =
  | "Instagram"
  | "TikTok"
  | "Google"
  | "Friend or Family"
  | "Other";

// Step 2 (mood + soft-commit checkbox + read-process-page checkbox) was
// removed in the May 2026 redesign — Korrin asked for no moods, Quinn +
// Rowan both flagged the checkboxes as noise. The wizard is now 3 steps:
// session/location → details → review.
type StepNum = 1 | 2 | 3;

interface Draft {
  sessionType: SessionType | "";
  preferredMonth: string;          // "" | "not-sure" | "YYYY-MM"
  locationLabel: string;           // free-form city / area
  locationDetail: string;
  message: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  smsConsent: boolean;             // "Can we contact you?" checkbox
  referralSource: ReferralSource;
  referredByEmail: string;         // optional — visitor types the email of who referred them
}

const DRAFT_KEY = "korrin-booking-draft";

const EMPTY_DRAFT: Draft = {
  sessionType: "",
  preferredMonth: "not-sure",
  locationLabel: "",
  locationDetail: "",
  message: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  smsConsent: false,
  referralSource: "Instagram",
  referredByEmail: "",
};

const STEP_TITLES: Record<StepNum, string> = {
  1: "What kind of session?",
  2: "Your details",
  3: "Review and send",
};

// ─── Static data ───────────────────────────────────────────────────────────

const SESSION_OPTIONS: { value: SessionType; label: string }[] = [
  { value: "Portrait",         label: "Portrait (senior, branding, solo)" },
  { value: "Family",           label: "Family / Couples" },
  { value: "Greek-life event", label: "Greek-life event (formal, philanthropy, mixer)" },
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

const validationHintStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  letterSpacing: "0.04em",
  color: "var(--charcoal-muted)",
  marginTop: "1.25rem",
  fontStyle: "italic",
  fontFamily: "'Cormorant Garamond', serif",
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

export function BookingFormSteps({
  initialSessionType = null,
}: {
  /**
   * Optional pre-selected session type. Legacy prop — kept so existing
   * callers don't break. When present it takes precedence over ?sessionType=
   * but not over ?package= (which also resolves to a sessionType). If not
   * provided (the common case) the component reads ?package= and ?sessionType=
   * from the URL via useSearchParams().
   */
  initialSessionType?: string | null;
} = {}) {
  const searchParams = useSearchParams();

  // Derive prefill values from URL params, applying the same normalization
  // logic that used to live in app/booking/page.tsx.
  const packageId = searchParams.get("package") ?? undefined;
  const sessionTypeParam = searchParams.get("sessionType") ?? undefined;
  // ?campaign= is informational — the server reads the __origin cookie for
  // attribution; we just surface it here for completeness.
  // const campaign = searchParams.get("campaign") ?? undefined;

  // ?package= wins over ?sessionType=, which wins over the legacy prop.
  const resolvedSessionType: string | null =
    findPackageById(packageId)?.sessionType ??
    (sessionTypeParam?.trim() || null) ??
    initialSessionType ??
    null;

  const [step, setStep] = useState<StepNum>(1);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const topRef = useRef<HTMLDivElement | null>(null);

  // Rehydrate from localStorage on mount. If a prefill sessionType was
  // resolved (from URL params or the legacy prop), overlay it on top of the
  // rehydrated draft — but only if the value matches a current SessionType.
  // Unknown legacy values (e.g. "Wedding") fall through and the dropdown
  // stays unselected, which is fine.
  useEffect(() => {
    const loaded = loadDraft();
    const known = SESSION_OPTIONS.find((o) => o.value === resolvedSessionType);
    setDraft(
      known
        ? { ...loaded, sessionType: known.value }
        : loaded,
    );
    setHydrated(true);
  }, [resolvedSessionType]);

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
  const step2Valid =
    draft.firstName.trim().length > 0 &&
    draft.lastName.trim().length > 0 &&
    isValidEmail(draft.email);
  const step3Valid = step1Valid && step2Valid;

  function step1Hint(): string | null {
    if (step1Valid) return null;
    return "Pick a session type to continue.";
  }
  function step2Hint(): string | null {
    if (step2Valid) return null;
    if (!draft.firstName.trim() || !draft.lastName.trim()) {
      return "Add your name so Korrin knows who to reply to.";
    }
    return "Add a valid email address so we can follow up.";
  }

  // ─── Submit ──────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!step3Valid) {
      setError("Please complete every step before sending.");
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
    if (draft.locationLabel.trim()) summaryLines.push(`Location: ${draft.locationLabel.trim()}`);
    if (draft.locationDetail.trim()) {
      summaryLines.push(`City / venue: ${draft.locationDetail.trim()}`);
    }
    const userMessage = draft.message.trim();
    const messageBody =
      (userMessage ? `${userMessage}\n\n— — —\n` : "") + summaryLines.join("\n");
    fd.set("message", messageBody);

    if (draft.preferredMonth && draft.preferredMonth !== "not-sure") {
      fd.set("preferredMonth", draft.preferredMonth);
    }
    if (draft.locationLabel.trim()) fd.set("locationLabel", draft.locationLabel.trim());
    if (draft.locationDetail.trim()) fd.set("locationDetail", draft.locationDetail.trim());
    if (draft.phone.trim()) fd.set("phone", draft.phone.trim());
    if (draft.smsConsent) fd.set("smsConsent", "on");
    fd.set("referralSource", draft.referralSource);
    if (draft.referredByEmail.trim()) fd.set("referredByEmail", draft.referredByEmail.trim());

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

  // Helper used by the review step's inline edit buttons.
  const goToStep = (target: StepNum) => {
    setError(null);
    setStep(target);
  };

  // Compute Next-button enablement for the *current* step.
  const canAdvance =
    step === 1 ? step1Valid : step === 2 ? step2Valid : step3Valid;

  const currentHint =
    step === 1 ? step1Hint() : step === 2 ? step2Hint() : null;

  // ─── Render ──────────────────────────────────────────────────────────────
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
        {step === 3 && (
          <Step3
            draft={draft}
            monthOptions={monthOptions}
            goToStep={goToStep}
          />
        )}

        {currentHint && !error && (
          <p style={validationHintStyle} role="status" aria-live="polite">
            {currentHint}
          </p>
        )}

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
          canAdvance={canAdvance}
          onBack={() =>
            setStep((s) => (s > 1 ? ((s - 1) as StepNum) : s))
          }
          onNext={() =>
            setStep((s) => (s < 3 ? ((s + 1) as StepNum) : s))
          }
        />
      </form>
    </div>
  );
}

// ─── Progress Bar ──────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: StepNum }) {
  return (
    <div style={{ marginBottom: "2.25rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "0.65rem",
          gap: "1rem",
        }}
      >
        <p
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
          }}
        >
          Step {step} of 3 — {STEP_TITLES[step]}
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
          {Math.round(((step - 1) / 2) * 100)}%
        </p>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "0.5rem",
        }}
      >
        {([1, 2, 3] as StepNum[]).map((n) => {
          const completed = n < step;
          const active = n === step;
          let background: string;
          let border: string;
          if (completed) {
            background = "var(--olive)";
            border = "0.5px solid var(--olive)";
          } else if (active) {
            background = "var(--olive)";
            border = "0.5px solid var(--olive)";
          } else {
            background = "transparent";
            border = "0.5px solid var(--border-strong)";
          }
          return (
            <div
              key={n}
              aria-hidden="true"
              style={{
                height: active ? "3px" : "2px",
                background,
                border,
                transition:
                  "background var(--transition), border-color var(--transition), height var(--transition)",
              }}
            />
          );
        })}
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

      <div style={{ marginBottom: "1.75rem" }}>
        <label style={labelStyle} htmlFor="sessionType">
          Session type
        </label>
        <select
          id="sessionType"
          value={draft.sessionType}
          onChange={(e) => update("sessionType", e.target.value as SessionType | "")}
          style={inputStyle}
        >
          <option value="">Select a session type</option>
          {SESSION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: "1.75rem" }}>
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

      <div style={{ marginBottom: "1.75rem" }}>
        <label style={labelStyle} htmlFor="locationLabel">
          Where will the session be? (optional)
        </label>
        <input
          id="locationLabel"
          type="text"
          value={draft.locationLabel}
          onChange={(e) => update("locationLabel", e.target.value)}
          placeholder="e.g. Tuscaloosa, AL / Louisville, KY / your sorority house"
          style={inputStyle}
          maxLength={120}
        />
      </div>

      <div>
        <label style={labelStyle} htmlFor="locationDetail">
          Venue or specific spot (optional)
        </label>
        <input
          id="locationDetail"
          type="text"
          value={draft.locationDetail}
          onChange={(e) => update("locationDetail", e.target.value)}
          placeholder="e.g. The Quad, the chapter room, Cherokee Park"
          style={inputStyle}
          maxLength={200}
        />
      </div>
    </div>
  );
}

// ─── Step 2 — Details ─────────────────────────────────────────────────────

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
        Your <em style={{ fontStyle: "italic" }}>details</em>
      </h2>

      <p
        style={{
          fontSize: "0.85rem",
          color: "var(--charcoal-muted)",
          lineHeight: 1.65,
          marginTop: "-1rem",
          marginBottom: "1.75rem",
          fontStyle: "italic",
          fontFamily: "'Cormorant Garamond', serif",
        }}
      >
        Curious what each package looks like?{" "}
        <Link
          href="/investment"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "var(--olive)",
            textDecoration: "underline",
            textUnderlineOffset: "3px",
          }}
        >
          Open the process page →
        </Link>
      </p>

      <div style={{ marginBottom: "2rem" }}>
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

      <div style={{ marginBottom: "0.75rem" }}>
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

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.6rem",
          fontSize: "0.82rem",
          color: "var(--charcoal-light)",
          lineHeight: 1.55,
          cursor: "pointer",
          marginBottom: "1.6rem",
        }}
      >
        <input
          type="checkbox"
          checked={draft.smsConsent}
          onChange={(e) => update("smsConsent", e.target.checked)}
          style={{
            marginTop: "0.2rem",
            accentColor: "var(--olive)",
            width: "14px",
            height: "14px",
            flexShrink: 0,
          }}
        />
        <span>It&apos;s ok to text me at this number.</span>
      </label>

      <div style={{ marginBottom: "1.25rem" }}>
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
          <option value="Instagram">Instagram</option>
          <option value="TikTok">TikTok</option>
          <option value="Google">Google</option>
          <option value="Friend or Family">Friend or Family</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div style={{ marginBottom: "0.5rem" }}>
        <label style={labelStyle} htmlFor="referredByEmail">
          Who referred you? (optional)
        </label>
        <input
          id="referredByEmail"
          type="email"
          value={draft.referredByEmail}
          onChange={(e) => update("referredByEmail", e.target.value)}
          style={inputStyle}
          placeholder="their@email.com"
          maxLength={120}
        />
        <p
          style={{
            fontSize: "0.72rem",
            color: "var(--charcoal-muted)",
            marginTop: "0.5rem",
            lineHeight: 1.5,
            fontStyle: "italic",
          }}
        >
          If a friend pointed you to Korrin, drop their email here so we can
          thank them properly.
        </p>
      </div>
    </div>
  );
}

// ─── Step 3 — Review ───────────────────────────────────────────────────────

function Step3({
  draft,
  monthOptions,
  goToStep,
}: {
  draft: Draft;
  monthOptions: { value: string; label: string }[];
  goToStep: (s: StepNum) => void;
}) {
  const monthValue =
    draft.preferredMonth && draft.preferredMonth !== "not-sure"
      ? monthOptions.find((m) => m.value === draft.preferredMonth)?.label ??
        draft.preferredMonth
      : "Not sure yet";

  const sessionTitle =
    SESSION_OPTIONS.find((s) => s.value === draft.sessionType)?.label ||
    draft.sessionType ||
    "—";

  const fullName = `${draft.firstName.trim()} ${draft.lastName.trim()}`.trim();

  return (
    <div>
      <p style={stepEyebrowStyle}>Step Three</p>
      <h2 style={stepHeadingStyle}>
        Look this <em style={{ fontStyle: "italic" }}>over</em>
      </h2>

      <p
        style={{
          fontSize: "0.88rem",
          color: "var(--charcoal-muted)",
          lineHeight: 1.7,
          marginTop: "-1rem",
          marginBottom: "1.75rem",
          fontStyle: "italic",
          fontFamily: "'Cormorant Garamond', serif",
        }}
      >
        Quick scan before it lands in Korrin&apos;s inbox. Tap any line to
        edit.
      </p>

      <ReviewSection
        title="Session"
        onEdit={() => goToStep(1)}
        rows={[
          { label: "Type", value: sessionTitle || "—" },
          { label: "Tentative month", value: monthValue },
          { label: "Location", value: draft.locationLabel.trim() || "—" },
          {
            label: "Venue or spot",
            value: draft.locationDetail.trim() || "—",
          },
        ]}
      />

      <ReviewSection
        title="Your details"
        onEdit={() => goToStep(2)}
        rows={[
          { label: "Name", value: fullName || "—" },
          { label: "Email", value: draft.email.trim() || "—" },
          {
            label: "Phone",
            value: draft.phone.trim()
              ? `${draft.phone.trim()}${draft.smsConsent ? " (text ok)" : ""}`
              : "—",
          },
          { label: "Heard about me via", value: draft.referralSource },
          {
            label: "Referred by",
            value: draft.referredByEmail.trim() || "—",
          },
          {
            label: "Note to Korrin",
            value: draft.message.trim() || "(no additional notes)",
            multiline: true,
          },
        ]}
      />

      <p
        style={{
          fontSize: "0.78rem",
          color: "var(--charcoal-muted)",
          lineHeight: 1.7,
          marginTop: "1.5rem",
          fontStyle: "italic",
        }}
      >
        After you send, you&apos;ll get an instant confirmation email and
        Korrin will reply personally within 48 hours.
      </p>
    </div>
  );
}

function ReviewSection({
  title,
  onEdit,
  rows,
}: {
  title: string;
  onEdit: () => void;
  rows: { label: string; value: string; multiline?: boolean }[];
}) {
  return (
    <section
      style={{
        border: "0.5px solid var(--border-strong)",
        borderLeft: "2px solid var(--olive)",
        background: "transparent",
        padding: "1.25rem 1.4rem",
        marginBottom: "1.25rem",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "1rem",
          gap: "1rem",
        }}
      >
        <p
          style={{
            fontSize: "0.62rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
          }}
        >
          {title}
        </p>
        <button
          type="button"
          onClick={onEdit}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--charcoal-light)",
            fontFamily: "'Jost', sans-serif",
            fontSize: "0.7rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            cursor: "pointer",
            padding: 0,
            textDecoration: "underline",
            textUnderlineOffset: "4px",
          }}
        >
          Edit
        </button>
      </header>
      <dl style={{ margin: 0 }}>
        {rows.map((row, i) => (
          <div
            key={row.label}
            style={{
              display: "grid",
              gridTemplateColumns: row.multiline ? "1fr" : "140px 1fr",
              gap: row.multiline ? "0.4rem" : "1rem",
              alignItems: "baseline",
              padding: "0.7rem 0",
              borderTop: i === 0 ? "none" : "0.5px solid var(--border)",
            }}
          >
            <dt
              style={{
                fontSize: "0.7rem",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--charcoal-muted)",
              }}
            >
              {row.label}
            </dt>
            <dd
              style={{
                margin: 0,
                fontSize: "0.92rem",
                color: "var(--charcoal)",
                lineHeight: 1.65,
                whiteSpace: row.multiline ? "pre-wrap" : "normal",
                fontFamily: "'Jost', sans-serif",
              }}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
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
  step: StepNum;
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
            borderRadius: 0,
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
            borderRadius: 0,
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
            borderRadius: 0,
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
