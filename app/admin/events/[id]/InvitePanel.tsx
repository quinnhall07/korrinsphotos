"use client";

// app/admin/events/[id]/InvitePanel.tsx
// Manage client access to an event.
// - Shows current clients with access
// - Invite new client by email (calls POST /api/invite)
// - Revoke access (calls revokeAccess server action)

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import { revokeAccess } from "./actions";

interface Client {
  userId: string;
  email: string;
  invitedAt: string;
}

interface InvitePanelProps {
  eventId: string;
  clients: Client[];
}

export function InvitePanel({ eventId, clients: initialClients }: InvitePanelProps) {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast("Please enter a valid email address.");
      return;
    }
    setIsSending(true);
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, eventId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invite failed");
      toast(`Invitation sent to ${email} ✓`);
      setEmail("");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invite failed";
      toast(`Error: ${msg}`);
    } finally {
      setIsSending(false);
    }
  }

  function handleRevoke(userId: string, clientEmail: string) {
    startTransition(async () => {
      await revokeAccess(userId, eventId);
      toast(`Access revoked for ${clientEmail}`);
      router.refresh();
    });
  }

  return (
    <div
      style={{
        border: "0.5px solid var(--border)",
        background: "var(--white)",
        marginBottom: "2rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1.2rem 1.5rem",
          borderBottom: "0.5px solid var(--border)",
        }}
      >
        <span
          style={{
            fontSize: "0.72rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--charcoal)",
            fontWeight: 500,
          }}
        >
          Client Access
        </span>
        <span style={{ fontSize: "0.72rem", color: "var(--charcoal-muted)" }}>
          {initialClients.length} client{initialClients.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div style={{ padding: "1.5rem" }}>
        {/* Current clients */}
        {initialClients.length > 0 && (
          <>
            <p
              style={{
                fontSize: "0.72rem",
                color: "var(--charcoal-muted)",
                marginBottom: "0.75rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Current access
            </p>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.85rem",
                marginBottom: "2rem",
              }}
            >
              <thead>
                <tr>
                  {["Email", "Invited", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "0.6rem 0.75rem",
                        fontSize: "0.65rem",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "var(--charcoal-muted)",
                        borderBottom: "0.5px solid var(--border-strong)",
                        fontWeight: 400,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {initialClients.map((client) => (
                  <tr key={client.userId}>
                    <td
                      style={{
                        padding: "0.75rem",
                        borderBottom: "0.5px solid var(--border)",
                        color: "var(--charcoal-light)",
                      }}
                    >
                      {client.email}
                    </td>
                    <td
                      style={{
                        padding: "0.75rem",
                        borderBottom: "0.5px solid var(--border)",
                        color: "var(--charcoal-muted)",
                        fontSize: "0.8rem",
                      }}
                    >
                      {client.invitedAt}
                    </td>
                    <td
                      style={{
                        padding: "0.75rem",
                        borderBottom: "0.5px solid var(--border)",
                        textAlign: "right",
                      }}
                    >
                      <button
                        onClick={() => handleRevoke(client.userId, client.email)}
                        disabled={isPending}
                        style={{
                          padding: "0.4rem 0.9rem",
                          fontSize: "0.65rem",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "var(--charcoal-muted)",
                          border: "0.5px solid var(--border-strong)",
                          background: "transparent",
                          cursor: isPending ? "not-allowed" : "pointer",
                          fontFamily: "'Jost', sans-serif",
                          transition: "all 0.2s",
                        }}
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Invite new client */}
        <p
          style={{
            fontSize: "0.68rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            marginBottom: "0.5rem",
          }}
        >
          Invite a new client
        </p>
        <form
          onSubmit={handleInvite}
          style={{ display: "flex", gap: 0 }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@email.com"
            required
            style={{
              flex: 1,
              border: "0.5px solid var(--border-strong)",
              borderRight: "none",
              background: "transparent",
              padding: "0.85rem 1rem",
              fontFamily: "'Jost', sans-serif",
              fontSize: "0.92rem",
              color: "var(--charcoal)",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={isSending}
            style={{
              padding: "0.85rem 1.5rem",
              fontSize: "0.72rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              background: isSending ? "var(--charcoal-muted)" : "var(--olive)",
              color: "var(--white)",
              border: "none",
              cursor: isSending ? "not-allowed" : "pointer",
              fontFamily: "'Jost', sans-serif",
              flexShrink: 0,
              transition: "background 0.2s",
            }}
          >
            {isSending ? "Sending…" : "Send Invite"}
          </button>
        </form>
        <p
          style={{
            fontSize: "0.72rem",
            color: "var(--charcoal-muted)",
            marginTop: "0.6rem",
            lineHeight: 1.6,
          }}
        >
          A magic link will be emailed via Resend granting access to this
          gallery.
        </p>
      </div>
    </div>
  );
}