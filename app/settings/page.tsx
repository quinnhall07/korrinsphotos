"use client";

// app/settings/page.tsx
// Client settings page — display name, contact info, connected accounts, notification preferences.

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { updateProfile } from "firebase/auth";
import { requireFirebaseAuth } from "@/lib/firebase";

type NotificationSettings = {
  galleryAlerts: boolean;
  bookingReminders: boolean;
};

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [notifications, setNotifications] = useState<NotificationSettings>({
    galleryAlerts: true,
    bookingReminders: true,
  });

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [activeSection, setActiveSection] = useState<string>("profile");

  // Load current user data
  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    setDisplayName(user.displayName ?? "");
    setContactEmail(user.email ?? "");

    // Load saved preferences from localStorage (in production, fetch from Firestore)
    const saved = localStorage.getItem(`settings_${user.uid}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPhoneNumber(parsed.phoneNumber ?? "");
        setNotifications(parsed.notifications ?? { galleryAlerts: true, bookingReminders: true });
      } catch {}
    }
  }, [user, router]);

  async function handleSaveProfile() {
    if (!user) return;
    setSaveStatus("saving");
    try {
      // Update Firebase Auth display name
      const auth = requireFirebaseAuth();
      if (!auth.currentUser) throw new Error("No current Firebase user");
      await updateProfile(auth.currentUser, { displayName });

      // Save extended settings to localStorage (in production, write to Firestore)
      localStorage.setItem(`settings_${user.uid}`, JSON.stringify({
        phoneNumber,
        notifications,
      }));

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  function toggleNotification(key: keyof NotificationSettings) {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const providers = user?.providerData.map((p) => p.providerId) ?? [];

  const PROVIDER_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
    "google.com": {
      label: "Google",
      icon: (
        <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
          <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
      ),
    },
    "microsoft.com": {
      label: "Microsoft",
      icon: (
        <svg width="16" height="16" viewBox="0 0 21 21" fill="none">
          <path d="M10 0H1v9h9V0z" fill="#F25022"/>
          <path d="M21 0h-9v9h9V0z" fill="#7FBA00"/>
          <path d="M10 11H1v9h9v-9z" fill="#00A4EF"/>
          <path d="M21 11h-9v9h9v-9z" fill="#FFB900"/>
        </svg>
      ),
    },
    "password": {
      label: "Email & Password",
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect x="2" y="7" width="12" height="8" rx="1"/>
          <path d="M5 7V5a3 3 0 016 0v2"/>
        </svg>
      ),
    },
  };

  const sections = [
    { id: "profile", label: "Profile" },
    { id: "notifications", label: "Notifications" },
    { id: "connected", label: "Connected Accounts" },
    { id: "account", label: "Account" },
  ];

  return (
    <div style={{ paddingTop: "72px", minHeight: "100vh", background: "var(--white)" }} className="page-fade-in">
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "3rem 2rem" }}>
        {/* Page header */}
        <div style={{ marginBottom: "2.5rem" }}>
          <p style={{ fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--olive)", marginBottom: "0.5rem" }}>
            Account
          </p>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2.4rem", fontWeight: 300, lineHeight: 1.2 }}>
            Settings
          </h1>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: "3rem", alignItems: "start" }}>
          {/* Sidebar nav */}
          <nav>
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "0.65rem 1rem",
                  fontSize: "0.78rem",
                  letterSpacing: "0.06em",
                  border: "none",
                  borderLeft: activeSection === s.id ? "2px solid var(--olive)" : "2px solid transparent",
                  color: activeSection === s.id ? "var(--charcoal)" : "var(--charcoal-muted)",
                  cursor: "pointer",
                  fontFamily: "'Jost', sans-serif",
                  transition: "all 0.2s",
                  marginBottom: "0.25rem",
                  background: activeSection === s.id ? "rgba(107,120,69,0.06)" : "transparent",
                } as React.CSSProperties}
              >
                {s.label}
              </button>
            ))}
          </nav>

          {/* Content panels */}
          <div>
            {/* ── Profile ── */}
            {activeSection === "profile" && (
              <div>
                <SectionHeader title="Profile Information" subtitle="Update your display name and contact details." />

                <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}>
                  <Field label="Display Name">
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your full name"
                      style={inputStyle}
                      className="form-input"
                    />
                  </Field>

                  <Field label="Contact Email" hint="Used for gallery notifications. Defaults to your login email.">
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="you@example.com"
                      style={inputStyle}
                      className="form-input"
                    />
                  </Field>

                  <Field label="Phone Number" hint="Optional. Used for SMS reminders if enabled.">
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      style={inputStyle}
                      className="form-input"
                    />
                  </Field>
                </div>

                <div style={{ marginTop: "2rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                  <button
                    onClick={handleSaveProfile}
                    disabled={saveStatus === "saving"}
                    style={{
                      padding: "0.75rem 2rem",
                      fontSize: "0.72rem",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      background: saveStatus === "saving" ? "var(--charcoal-muted)" : "var(--olive)",
                      color: "var(--white)",
                      border: "none",
                      cursor: saveStatus === "saving" ? "not-allowed" : "pointer",
                      fontFamily: "'Jost', sans-serif",
                      transition: "background 0.2s",
                    }}
                  >
                    {saveStatus === "saving" ? "Saving…" : "Save Changes"}
                  </button>
                  {saveStatus === "saved" && (
                    <span style={{ fontSize: "0.78rem", color: "var(--olive)", letterSpacing: "0.04em" }}>
                      ✓ Changes saved
                    </span>
                  )}
                  {saveStatus === "error" && (
                    <span style={{ fontSize: "0.78rem", color: "#B45309", letterSpacing: "0.04em" }}>
                      Something went wrong. Please try again.
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* ── Notifications ── */}
            {activeSection === "notifications" && (
              <div>
                <SectionHeader title="Notification Preferences" subtitle="Choose when and how you'd like to be notified." />

                <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                  <ToggleRow
                    label="Gallery Alerts"
                    description="Receive an email when a new gallery or photo is added to your account."
                    checked={notifications.galleryAlerts}
                    onChange={() => toggleNotification("galleryAlerts")}
                  />
                  <ToggleRow
                    label="Booking Reminders"
                    description="Automated reminders 24–48 hours before an upcoming scheduled shoot."
                    checked={notifications.bookingReminders}
                    onChange={() => toggleNotification("bookingReminders")}
                    last
                  />
                </div>

                <div style={{ marginTop: "2rem" }}>
                  <button
                    onClick={handleSaveProfile}
                    disabled={saveStatus === "saving"}
                    style={{
                      padding: "0.75rem 2rem",
                      fontSize: "0.72rem",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      background: "var(--olive)",
                      color: "var(--white)",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "'Jost', sans-serif",
                    }}
                  >
                    {saveStatus === "saving" ? "Saving…" : "Save Preferences"}
                  </button>
                  {saveStatus === "saved" && (
                    <span style={{ marginLeft: "1rem", fontSize: "0.78rem", color: "var(--olive)" }}>✓ Saved</span>
                  )}
                </div>
              </div>
            )}

            {/* ── Connected Accounts ── */}
            {activeSection === "connected" && (
              <div>
                <SectionHeader title="Connected Accounts" subtitle="Manage the services linked to your Korrin's Photos account." />

                <div style={{ border: "0.5px solid var(--border)", overflow: "hidden" }}>
                  {Object.entries(PROVIDER_LABELS).map(([providerId, { label, icon }], i, arr) => {
                    const connected = providers.includes(providerId) || (providerId === "password" && providers.includes("password"));
                    return (
                      <div
                        key={providerId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "1rem 1.2rem",
                          borderBottom: i < arr.length - 1 ? "0.5px solid var(--border)" : "none",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <span style={{ display: "flex", opacity: connected ? 1 : 0.35 }}>{icon}</span>
                          <div>
                            <p style={{ fontSize: "0.85rem", color: "var(--charcoal)", fontWeight: 400 }}>{label}</p>
                            <p style={{ fontSize: "0.72rem", color: "var(--charcoal-muted)", marginTop: "0.1rem" }}>
                              {connected ? "Connected" : "Not connected"}
                            </p>
                          </div>
                        </div>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.25rem 0.75rem",
                            fontSize: "0.62rem",
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            background: connected ? "#D1FAE5" : "rgba(42,42,40,0.06)",
                            color: connected ? "#065F46" : "var(--charcoal-muted)",
                          }}
                        >
                          {connected ? "Active" : "Inactive"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "var(--charcoal-muted)", lineHeight: 1.6 }}>
                  Connected accounts allow you to sign in using those services. Contact Korrin to update your login method.
                </p>
              </div>
            )}

            {/* ── Account ── */}
            {activeSection === "account" && (
              <div>
                <SectionHeader title="Account" subtitle="Manage your account and sign out." />

                <div
                  style={{
                    border: "0.5px solid var(--border)",
                    padding: "1.5rem",
                    marginBottom: "1.5rem",
                  }}
                >
                  <p style={{ fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--charcoal-muted)", marginBottom: "0.4rem" }}>
                    Signed in as
                  </p>
                  <p style={{ fontSize: "0.95rem", color: "var(--charcoal)", marginBottom: "0.2rem" }}>
                    {user?.displayName || "—"}
                  </p>
                  <p style={{ fontSize: "0.82rem", color: "var(--charcoal-muted)" }}>
                    {user?.email}
                  </p>
                </div>

                <button
                  onClick={() => signOut()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    padding: "0.75rem 2rem",
                    fontSize: "0.72rem",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    background: "transparent",
                    color: "var(--charcoal)",
                    border: "0.5px solid var(--border-strong)",
                    cursor: "pointer",
                    fontFamily: "'Jost', sans-serif",
                    transition: "all 0.2s",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <path d="M5 2H2a1 1 0 00-1 1v8a1 1 0 001 1h3M9 10l3-3-3-3M12 7H5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Sign Out
                </button>

                <div
                  style={{
                    marginTop: "3rem",
                    paddingTop: "2rem",
                    borderTop: "0.5px solid var(--border)",
                  }}
                >
                  <p style={{ fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#B45309", marginBottom: "0.5rem" }}>
                    Danger Zone
                  </p>
                  <p style={{ fontSize: "0.82rem", color: "var(--charcoal-muted)", lineHeight: 1.7, marginBottom: "1rem" }}>
                    To delete your account or request your data, please contact Korrin directly.
                  </p>
                  <a
                    href="/booking"
                    style={{
                      display: "inline-block",
                      fontSize: "0.72rem",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "#B45309",
                      border: "0.5px solid #B45309",
                      padding: "0.6rem 1.4rem",
                      textDecoration: "none",
                      opacity: 0.7,
                    }}
                  >
                    Contact Korrin
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: "2rem", paddingBottom: "1.5rem", borderBottom: "0.5px solid var(--border)" }}>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.6rem", fontWeight: 300, marginBottom: "0.35rem" }}>
        {title}
      </h2>
      <p style={{ fontSize: "0.82rem", color: "var(--charcoal-muted)", lineHeight: 1.6 }}>{subtitle}</p>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.68rem", letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "var(--charcoal-muted)", marginBottom: "0.5rem" }}>
        {label}
      </label>
      {children}
      {hint && (
        <p style={{ fontSize: "0.72rem", color: "var(--charcoal-muted)", marginTop: "0.4rem", lineHeight: 1.5 }}>{hint}</p>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  last = false,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "2rem",
        padding: "1.25rem 0",
        borderBottom: last ? "none" : "0.5px solid var(--border)",
      }}
    >
      <div>
        <p style={{ fontSize: "0.88rem", color: "var(--charcoal)", fontWeight: 400, marginBottom: "0.3rem" }}>{label}</p>
        <p style={{ fontSize: "0.78rem", color: "var(--charcoal-muted)", lineHeight: 1.6 }}>{description}</p>
      </div>

      {/* Toggle switch */}
      <button
        onClick={onChange}
        role="switch"
        aria-checked={checked}
        style={{
          flexShrink: 0,
          position: "relative",
          width: "42px",
          height: "24px",
          borderRadius: "12px",
          background: checked ? "var(--olive)" : "rgba(42,42,40,0.15)",
          border: "none",
          cursor: "pointer",
          transition: "background 0.25s",
          padding: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "3px",
            left: checked ? "21px" : "3px",
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            background: "var(--white)",
            transition: "left 0.25s",
            boxShadow: "0 1px 3px rgba(42,42,40,0.2)",
          }}
        />
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "0.5px solid var(--border-strong)",
  background: "transparent",
  padding: "0.85rem 1rem",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.92rem",
  color: "var(--charcoal)",
  outline: "none",
  borderRadius: 0,
};
