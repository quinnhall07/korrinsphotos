"use client";

// app/admin/bookings/EmailTemplateSelector.tsx
// Pre-built email templates that auto-populate the response composer.
// Templates use {firstName} and {sessionType} as placeholders.

interface Template {
  id: string;
  label: string;
  subject: (sessionType: string) => string;
  body: (firstName: string, sessionType: string) => string;
}

const TEMPLATES: Template[] = [
  {
    id: "warm-intro",
    label: "Warm Introduction",
    subject: (s) => `Re: Your ${s} Inquiry`,
    body: (name, session) =>
      `Hi ${name},\n\nThank you so much for reaching out about your ${session.toLowerCase()} — I'm genuinely excited about this!\n\nI've reviewed your inquiry and I'd love to connect. Would you be open to a quick 15-minute call this week so I can learn more about your vision and share some initial ideas?\n\nLooking forward to hearing from you!\n\nWarm regards,\nKorrin`,
  },
  {
    id: "availability-check",
    label: "Availability Check",
    subject: (s) => `${s} Availability — Let's Check Dates`,
    body: (name, session) =>
      `Hi ${name},\n\nThank you for considering me for your ${session.toLowerCase()}!\n\nBefore we dive into the details, I wanted to check in on your timeline. Could you share 2–3 date options that work for you? I'll confirm my availability within 24 hours.\n\nAlso, feel free to share any inspiration images or locations you have in mind — it really helps me understand your aesthetic.\n\nBest,\nKorrin`,
  },
  {
    id: "proposal-ready",
    label: "Proposal Ready",
    subject: (s) => `Your Custom ${s} Proposal`,
    body: (name, session) =>
      `Hi ${name},\n\nI've been thinking about your ${session.toLowerCase()} and I'm excited to share a custom proposal I've put together for you.\n\nI'll be sending over the full details shortly — it includes pricing, what's included, and a peek at similar work I've done.\n\nIn the meantime, please don't hesitate to reach out with any questions. I'm here to make this process as easy and enjoyable as possible.\n\nTalk soon,\nKorrin`,
  },
  {
    id: "follow-up",
    label: "Gentle Follow-Up",
    subject: (s) => `Following Up — Your ${s} Inquiry`,
    body: (name) =>
      `Hi ${name},\n\nI wanted to follow up on our recent conversation — I know things can get busy!\n\nI'm still holding your date and would love to move forward. If you have any questions or concerns I can address, please let me know. I'm happy to jump on a quick call.\n\nNo pressure at all — just want to make sure you have everything you need to make a decision.\n\nBest,\nKorrin`,
  },
  {
    id: "not-available",
    label: "Unavailable — Kind Decline",
    subject: (s) => `Re: Your ${s} Inquiry`,
    body: (name, session) =>
      `Hi ${name},\n\nThank you so much for reaching out about your ${session.toLowerCase()}! I'm truly flattered.\n\nUnfortunately, I'm already booked for that date and I'd hate to overcommit and not give you the full attention your occasion deserves.\n\nIf you have any flexibility on timing, I'd love to explore other options. Otherwise, I'd be happy to refer you to some incredibly talented colleagues whose work I admire.\n\nI hope your ${session.toLowerCase()} is everything you've dreamed of!\n\nWarmly,\nKorrin`,
  },
];

interface EmailTemplateSelectorProps {
  firstName: string;
  sessionType: string;
  onSelect: (subject: string, body: string) => void;
}

export function EmailTemplateSelector({
  firstName,
  sessionType,
  onSelect,
}: EmailTemplateSelectorProps) {
  return (
    <div>
      <p
        style={{
          fontSize: "0.65rem",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--charcoal-muted)",
          marginBottom: "0.6rem",
        }}
      >
        Load a template
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
        {TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() =>
              onSelect(
                tpl.subject(sessionType),
                tpl.body(firstName, sessionType)
              )
            }
            style={{
              padding: "0.35rem 0.85rem",
              fontSize: "0.65rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
              background: "transparent",
              color: "var(--charcoal)",
              border: "0.5px solid var(--border-strong)",
              fontFamily: "'Jost', sans-serif",
              transition: "all 0.15s",
            }}
          >
            {tpl.label}
          </button>
        ))}
      </div>
    </div>
  );
}