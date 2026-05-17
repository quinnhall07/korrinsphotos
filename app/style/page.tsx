// app/style/page.tsx
// Public style-quiz funnel (Phase 2.2).
//
// 8-question A/B aesthetic preference quiz that captures a visitor's visual
// taste. Submission writes to `styleProfiles/{email}` and surfaces on the
// admin project workspace next to the questionnaire. The AI mood-board
// generator (Phase 5.8) will read `tagSummary` from the same doc — for now
// we render a static "example mood board" on the success screen as a stub
// for that future feature.

import type { Metadata } from "next";
import { StyleQuizClient } from "./StyleQuizClient";

export const metadata: Metadata = {
  title: "Style Quiz",
  description:
    "Take a 60-second visual style quiz so Korrin can tailor your session to your taste.",
};

export default function StylePage() {
  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      <div
        style={{
          minHeight: "calc(100vh - 72px)",
          padding: "4rem 2rem 6rem",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div style={{ width: "100%", maxWidth: "920px" }}>
          <header style={{ textAlign: "center", marginBottom: "3rem" }}>
            <p
              style={{
                fontSize: "0.65rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--olive)",
                marginBottom: "1rem",
              }}
            >
              The Style Quiz
            </p>
            <h1
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "2.8rem",
                fontWeight: 300,
                lineHeight: 1.2,
                color: "var(--charcoal)",
                marginBottom: "0.75rem",
              }}
            >
              Find your <em>aesthetic</em>
            </h1>
            <p
              style={{
                fontSize: "0.95rem",
                color: "var(--charcoal-muted)",
                lineHeight: 1.7,
                maxWidth: "520px",
                margin: "0 auto",
              }}
            >
              Eight quick A/B questions. No wrong answers — just instinct.
              Korrin uses your picks to tailor the brief for your session.
            </p>
          </header>

          <StyleQuizClient />
        </div>
      </div>
    </div>
  );
}
