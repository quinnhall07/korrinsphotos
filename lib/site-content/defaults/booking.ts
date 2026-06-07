// lib/site-content/defaults/booking.ts
// Seed sections for the Booking page: editable intro copy + the embedded form.
import type { Section } from "@/lib/site-content/types";

export const BOOKING_DEFAULTS: Section[] = [
  {
    id: "booking-hero",
    type: "HERO",
    slides: [],
    eyebrow: "Booking",
    headline: "Let's make something timeless",
    sub: "Share a few details about your session and I'll reply within two business days.",
  },
  {
    id: "booking-form",
    type: "BOOKING_FORM",
    heading: "Tell me about your session",
    intro: "Every field helps me prepare. There are no wrong answers.",
  },
];
