import { adminDb } from "@/lib/firebase-admin";
import type { ProjectDoc } from "./db/projects";
import type { ClientDoc } from "./db/clients";

// In a real application, you might use Handlebars or EJS.
// For simplicity and speed, we use a custom token replacer.
export async function renderContractHtml(
  templateHtml: string,
  project: ProjectDoc,
  client: ClientDoc
): Promise<string> {
  const replacements: Record<string, string> = {
    "{{CLIENT_FIRST_NAME}}": client.firstName || "",
    "{{CLIENT_LAST_NAME}}": client.lastName || "",
    "{{CLIENT_EMAIL}}": client.email || "",
    "{{CLIENT_PHONE}}": client.phone || "__________________",
    "{{PROJECT_TITLE}}": project.title || "",
    "{{SESSION_TYPE}}": project.sessionType || "",
    "{{SHOOT_DATE}}": project.shootDate ? new Date(project.shootDate.toMillis()).toLocaleDateString() : "TBD",
    "{{SHOOT_LOCATION}}": project.shootLocation?.label || "TBD",
    "{{PACKAGE_NAME}}": project.packageName || "Custom Package",
    "{{PACKAGE_PRICE}}": project.packagePriceUsd ? `$${project.packagePriceUsd}` : "TBD",
    "{{TODAY_DATE}}": new Date().toLocaleDateString(),
  };

  let rendered = templateHtml;
  for (const [token, value] of Object.entries(replacements)) {
    // Replace all instances of the token
    const regex = new RegExp(token, "g");
    rendered = rendered.replace(regex, value);
  }

  return rendered;
}

export async function generateContractForProject(projectId: string, templateId: string = "default") {
  const projectSnap = await adminDb.collection("projects").doc(projectId).get();
  if (!projectSnap.exists) throw new Error("Project not found");
  const project = projectSnap.data() as ProjectDoc;

  const clientSnap = await adminDb.collection("clients").doc(project.clientId).get();
  if (!clientSnap.exists) throw new Error("Client not found");
  const client = clientSnap.data() as ClientDoc;

  // Ideally fetch template from Firestore `contractTemplates` collection
  let templateHtml = `
  <div style="font-family: serif; line-height: 1.6; max-width: 800px; margin: 0 auto;">
    <h1 style="text-align: center; border-bottom: 1px solid #ccc; padding-bottom: 20px;">Photography Services Agreement</h1>
    <p>This agreement is made on <strong>{{TODAY_DATE}}</strong> between Korrin's Photography ("Photographer") and <strong>{{CLIENT_FIRST_NAME}} {{CLIENT_LAST_NAME}}</strong> ("Client").</p>
    
    <h2>1. The Services</h2>
    <p>The Photographer agrees to provide {{SESSION_TYPE}} photography services for the Client's project titled "{{PROJECT_TITLE}}".</p>
    <ul>
      <li><strong>Date:</strong> {{SHOOT_DATE}}</li>
      <li><strong>Location:</strong> {{SHOOT_LOCATION}}</li>
      <li><strong>Package:</strong> {{PACKAGE_NAME}}</li>
    </ul>

    <h2>2. Payment</h2>
    <p>The total investment for the services is <strong>{{PACKAGE_PRICE}}</strong>. A 50% non-refundable retainer is due upon signing to secure the date. The remaining balance is due prior to final gallery delivery.</p>

    <h2>3. Copyright & Usage</h2>
    <p>The Photographer retains the copyright to all images. The Client is granted a personal print release for non-commercial use.</p>

    <div style="margin-top: 50px; display: flex; justify-content: space-between;">
      <div style="width: 45%;">
        <p><strong>Photographer:</strong></p>
        <div style="border-bottom: 1px solid #000; height: 30px;">Korrin</div>
      </div>
      <div style="width: 45%;">
        <p><strong>Client:</strong></p>
        <div style="border-bottom: 1px solid #000; height: 30px;"></div>
        <p style="font-size: 0.8rem; color: #666; margin-top: 5px;">{{CLIENT_FIRST_NAME}} {{CLIENT_LAST_NAME}}</p>
      </div>
    </div>
  </div>
  `;

  // Fetch actual template if exists
  const tplSnap = await adminDb.collection("contractTemplates").doc(templateId).get();
  if (tplSnap.exists) {
    templateHtml = tplSnap.data()?.html || templateHtml;
  }

  const renderedHtml = await renderContractHtml(templateHtml, project, client);

  // Create contract record
  const contractRef = adminDb.collection("contracts").doc();
  const contractData = {
    projectId,
    clientId: project.clientId,
    status: "DRAFT",
    templateId,
    renderedHtml,
    createdAt: new Date(),
  };

  await contractRef.set(contractData);
  return contractRef.id;
}
