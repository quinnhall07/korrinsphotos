"use server";

// app/style/actions.ts
// Server Action for the public style quiz. Validates payload, derives the
// `tagSummary` from the chosen answers, and upserts the
// `styleProfiles/{email}` doc. Surfaced on `/admin/projects/[id]` so Korrin
// can see the client's aesthetic alongside their questionnaire answers.
//
// NOTE: This is the data-collection half of Phase 2.2. The AI mood-board
// generator (Phase 5.8) will read `tagSummary` from the same doc and
// generate a per-client mood board — currently stubbed with a static grid
// on the client success screen.

import { z } from "zod";
import { upsertStyleProfile } from "@/lib/db/style-profiles";
import { STYLE_QUESTIONS, deriveTagSummary } from "./questions";

const QuizSchema = z.object({
  email: z.string().email("Please enter a valid email address.").max(200),
  firstName: z
    .string()
    .min(1, "First name is required.")
    .max(100),
  answers: z.record(z.string().min(1), z.string().min(1)),
});

export type StyleQuizResult =
  | { success: true; tagSummary: string[] }
  | { success: false; error: string };

export async function submitStyleQuiz(input: {
  email: string;
  firstName: string;
  answers: Record<string, string>;
}): Promise<StyleQuizResult> {
  const parsed = QuizSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid quiz submission.",
    };
  }

  const { email, firstName, answers } = parsed.data;

  // Validate that every answered question id + option id exists in the
  // catalog. Unknown ids are dropped silently — partial-but-valid is fine.
  const cleanAnswers: Record<string, string> = {};
  for (const question of STYLE_QUESTIONS) {
    const chosen = answers[question.id];
    if (!chosen) continue;
    if (question.options.some((o) => o.id === chosen)) {
      cleanAnswers[question.id] = chosen;
    }
  }

  if (Object.keys(cleanAnswers).length === 0) {
    return {
      success: false,
      error: "Please answer at least one question before submitting.",
    };
  }

  const tagSummary = deriveTagSummary(cleanAnswers);

  try {
    await upsertStyleProfile({
      email,
      firstName: firstName.trim(),
      answers: cleanAnswers,
      tagSummary,
    });
    return { success: true, tagSummary };
  } catch (err) {
    console.error("[submitStyleQuiz] upsert failed", err);
    return {
      success: false,
      error: "Unable to save your style profile right now. Please try again.",
    };
  }
}
