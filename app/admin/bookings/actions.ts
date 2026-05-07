"use server";

// app/admin/bookings/actions.ts
// Re-export hub for all booking-related server actions.
// Modularized into domain-specific files for maintainability.

export * from "./inquiry-actions";
export * from "./tag-actions";
export * from "./comms-actions";
