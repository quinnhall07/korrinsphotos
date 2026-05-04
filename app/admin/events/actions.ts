"use server";

// app/admin/events/actions.ts
// Server Action: Creates a new event and redirects to its detail page.

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function createEvent(formData: FormData) {
  // 1. Verify the user is logged in and is an ADMIN
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  // 2. Grab the title from the hidden form input (fallback to "New Event")
  const title = (formData.get("title") as string) || "New Event";

  // 3. Create the new event in the database
  const newEvent = await prisma.event.create({
    data: {
      title,
    },
  });

  // 4. Redirect to the newly created event's manage page
  redirect(`/admin/events/${newEvent.id}`);
}