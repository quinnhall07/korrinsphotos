import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { ProjectStatus } from "./db/projects";

// Called when project status changes
export async function handleProjectTransition(projectId: string, fromStatus: ProjectStatus, toStatus: ProjectStatus) {
  if (fromStatus === toStatus) return;

  if (toStatus === "BOOKED") {
    await onProjectBooked(projectId);
  } else if (toStatus === "PROPOSAL_SENT") {
    await onProposalSent(projectId);
  } else if (toStatus === "GALLERY_DELIVERED") {
    await onGalleryDelivered(projectId);
  }
}

async function onProjectBooked(projectId: string) {
  const projectSnap = await adminDb.collection("projects").doc(projectId).get();
  if (!projectSnap.exists) return;
  const project = projectSnap.data()!;
  
  const clientSnap = await adminDb.collection("clients").doc(project.clientId).get();
  if (!clientSnap.exists) return;
  const client = clientSnap.data()!;

  // 1. Auto-create Event (no manual step)
  const eventRef = adminDb.collection("events").doc();
  await eventRef.set({
    projectId: projectId,
    clientId: project.clientId,
    title: project.title,
    shootDate: project.shootDate,
    status: "UPCOMING",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // 2. Auto-grant client portal access
  // Resolve (or provision) the Firebase Auth user for this client so the
  // eventAccess doc is keyed by the real Auth UID — not the Firestore client
  // doc id. See ADR-009: `${userId}_${eventId}` where `userId` is the Auth UID.
  const displayName = `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim();
  let uid: string;
  try {
    const existing = await adminAuth.getUserByEmail(client.email);
    uid = existing.uid;
  } catch (err: any) {
    if (err?.code === "auth/user-not-found") {
      try {
        const created = await adminAuth.createUser({
          email: client.email,
          ...(displayName ? { displayName } : {}),
        });
        uid = created.uid;
      } catch (createErr) {
        console.error("[onProjectBooked] Failed to create Firebase Auth user", {
          projectId,
          clientId: project.clientId,
          email: client.email,
          error: createErr,
        });
        throw createErr;
      }
    } else {
      console.error("[onProjectBooked] Failed to resolve Firebase Auth user", {
        projectId,
        clientId: project.clientId,
        email: client.email,
        error: err,
      });
      throw err;
    }
  }

  // Upsert the users/{uid} mirror doc so the client can sign in as CLIENT.
  await adminDb.collection("users").doc(uid).set({
    email: client.email,
    role: "CLIENT",
    ...(displayName ? { displayName } : {}),
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  const accessId = `${uid}_${eventRef.id}`;
  await adminDb.collection("eventAccess").doc(accessId).set({
    userId: uid,
    eventId: eventRef.id,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  // 3. Increment client's session count
  await adminDb.collection("clients").doc(project.clientId).update({
    totalSessionsBooked: FieldValue.increment(1),
  });

  // 4. Auto-send questionnaire (Placeholder for mail trigger)
  await adminDb.collection("mail").add({
    to: client.email,
    message: {
      subject: `Questionnaire for your upcoming ${project.sessionType}`,
      text: `Please fill out your questionnaire at /questionnaire/${projectId}`,
    },
    createdAt: FieldValue.serverTimestamp()
  });

  // 5. Create balance invoice
  if (project.packagePriceUsd) {
    const invoiceRef = adminDb.collection("invoices").doc();
    await invoiceRef.set({
      projectId,
      clientId: project.clientId,
      type: "BALANCE",
      status: "DRAFT",
      amountCents: (project.packagePriceUsd * 0.5) * 100, // Remaining 50%
      dueDate: project.shootDate ? new Date(project.shootDate.toMillis() - 14 * 24 * 60 * 60 * 1000) : null,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}

async function onProposalSent(projectId: string) {
  const projectSnap = await adminDb.collection("projects").doc(projectId).get();
  if (!projectSnap.exists) return;
  const project = projectSnap.data()!;

  // Create deposit invoice (DRAFT)
  if (project.packagePriceUsd) {
    const invoiceRef = adminDb.collection("invoices").doc();
    await invoiceRef.set({
      projectId,
      clientId: project.clientId,
      type: "DEPOSIT",
      status: "DRAFT",
      amountCents: (project.packagePriceUsd * 0.5) * 100, // 50% deposit
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}

async function onGalleryDelivered(projectId: string) {
  const projectSnap = await adminDb.collection("projects").doc(projectId).get();
  if (!projectSnap.exists) return;
  const project = projectSnap.data()!;

  // Send gallery notification email (handled elsewhere or by trigger)
  
  // Schedule referral email: 7 days out
  const runAtDate = new Date();
  runAtDate.setDate(runAtDate.getDate() + 7);
  
  await adminDb.collection("scheduledTasks").add({
    type: "SEND_REFERRAL",
    projectId,
    clientId: project.clientId,
    runAt: runAtDate,
    status: "PENDING",
    createdAt: FieldValue.serverTimestamp()
  });
}
