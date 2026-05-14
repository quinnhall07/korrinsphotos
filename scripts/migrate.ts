import { adminDb } from "../lib/firebase-admin";
import { generateReferralCode } from "../lib/db/clients";
import type { Role } from "../lib/db/users";
import { Timestamp } from "firebase-admin/firestore";

async function run() {
  console.log("Starting Migration...");

  // 1. Migrate Users -> Clients
  const usersSnap = await adminDb.collection("users").where("role", "==", "CLIENT").get();
  console.log(`Found ${usersSnap.size} client users to migrate.`);

  let migratedClientsCount = 0;
  for (const doc of usersSnap.docs) {
    const userData = doc.data();
    
    // Check if client already exists
    const existingClient = await adminDb.collection("clients").where("email", "==", userData.email).limit(1).get();
    if (existingClient.empty) {
      // Create new client
      const firstName = userData.displayName ? userData.displayName.split(" ")[0] : "Unknown";
      const lastName = userData.displayName ? userData.displayName.split(" ").slice(1).join(" ") : "";
      
      await adminDb.collection("clients").doc(userData.uid).set({
        email: userData.email,
        firstName,
        lastName,
        avatarUrl: userData.photoURL || null,
        role: "CLIENT" as Role,
        referralCode: generateReferralCode(firstName),
        referralCredit: 0,
        totalSessionsBooked: 0,
        firstTouchSource: "WEBSITE",
        firstTouchAt: userData.createdAt || Timestamp.now(),
        createdAt: userData.createdAt || Timestamp.now(),
        updatedAt: userData.updatedAt || Timestamp.now(),
      });
      migratedClientsCount++;
    }
  }
  console.log(`Migrated ${migratedClientsCount} users to clients.`);

  // 2. Migrate BookingInquiries -> Projects
  const inquiriesSnap = await adminDb.collection("bookingInquiries").get();
  console.log(`Found ${inquiriesSnap.size} booking inquiries to migrate.`);

  let migratedProjectsCount = 0;
  for (const doc of inquiriesSnap.docs) {
    const inquiryData = doc.data();
    
    // Check if project already exists
    const existingProject = await adminDb.collection("projects").where("legacyInquiryId", "==", doc.id).limit(1).get();
    if (existingProject.empty) {
      // Find or create client for this inquiry
      let clientId: string;
      const clientSnap = await adminDb.collection("clients").where("email", "==", inquiryData.email).limit(1).get();
      
      if (!clientSnap.empty) {
        clientId = clientSnap.docs[0].id;
      } else {
        const clientRef = adminDb.collection("clients").doc();
        clientId = clientRef.id;
        await clientRef.set({
          email: inquiryData.email,
          firstName: inquiryData.firstName || "Unknown",
          lastName: inquiryData.lastName || "",
          role: "CLIENT" as Role,
          referralCode: generateReferralCode(inquiryData.firstName || "Unknown"),
          referralCredit: 0,
          totalSessionsBooked: 0,
          firstTouchSource: inquiryData.leadSource || "WEBSITE",
          firstTouchAt: inquiryData.createdAt || Timestamp.now(),
          createdAt: inquiryData.createdAt || Timestamp.now(),
          updatedAt: inquiryData.updatedAt || Timestamp.now(),
        });
      }

      // Map status
      let newStatus = "INQUIRY";
      if (inquiryData.status === "QUALIFIED") newStatus = "QUALIFYING";
      else if (inquiryData.status === "SENT_PROPOSAL") newStatus = "PROPOSAL_SENT";
      else if (inquiryData.status === "CONTRACT_SENT") newStatus = "CONTRACT_SENT";
      else if (inquiryData.status === "BOOKED") newStatus = "BOOKED";
      else if (inquiryData.status === "ARCHIVED") newStatus = "ARCHIVED";

      await adminDb.collection("projects").doc().set({
        clientId,
        legacyInquiryId: doc.id,
        status: newStatus,
        sessionType: inquiryData.sessionType || "Other",
        title: `${inquiryData.firstName || "Client"} ${inquiryData.lastName || ""} — ${inquiryData.sessionType || "Session"}`,
        leadSource: inquiryData.leadSource || "WEBSITE",
        leadScore: inquiryData.leadScore || 0,
        tags: inquiryData.tags || [],
        notes: inquiryData.notes || "",
        estimatedValue: inquiryData.estimatedValue || null,
        followUpDate: inquiryData.followUpDate || null,
        lastContactedAt: inquiryData.lastContactedAt || null,
        lastRespondedAt: inquiryData.lastRespondedAt || null,
        createdAt: inquiryData.createdAt || Timestamp.now(),
        updatedAt: inquiryData.updatedAt || Timestamp.now(),
      });
      
      migratedProjectsCount++;
    }
  }
  console.log(`Migrated ${migratedProjectsCount} inquiries to projects.`);
  console.log("Migration complete!");
}

run().catch(console.error);
