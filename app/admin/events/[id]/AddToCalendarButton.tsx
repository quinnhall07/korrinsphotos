"use client";

// app/admin/events/[id]/AddToCalendarButton.tsx
// Provides "Add to Calendar" dropdown for Google Calendar and Outlook.
// Uses URL schemes — no OAuth required.

import { useState, useRef, useEffect } from "react";

interface AddToCalendarButtonProps {
  eventTitle: string;
  eventDate: string; // ISO string
}

function formatGoogleDate(iso: string): string {
  // Google Calendar needs YYYYMMDD format
  const date = new Date(iso);
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function buildGoogleCalendarUrl(title: string, dateIso: string): string {
  const start = formatGoogleDate(dateIso);
  // Default to an all-day event for the shoot date
  // For a full-day event Google Calendar wants just YYYYMMDD
  const dateOnly = new Date(dateIso).toISOString().split("T")[0].replace(/-/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${dateOnly}/${dateOnly}`,
    details: `Photography session: ${title}. Managed via Korrin's Photos.`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildOutlookUrl(title: string, dateIso: string): string {
  const date = new Date(dateIso);
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    startdt: date.toISOString().split("T")[0],
    enddt: date.toISOString().split("T")[0],
    subject: title,
    body: `Photography session: ${title}. Managed via Korrin's Photos.`,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function AddToCalendarButton({ eventTitle, eventDate }: AddToCalendarButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.6rem 1.2rem",
          fontSize: "0.68rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          background: "transparent",
          color: "var(--charcoal)",
          border: "0.5px solid var(--border-strong)",
          cursor: "pointer",
          fontFamily: "'Jost', sans-serif",
          transition: "all 0.2s",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
          <rect x="1" y="4" width="14" height="11" rx="1"/>
          <path d="M5 1v4M11 1v4M1 8h14"/>
          <path d="M8 11v2M7 12h2"/>
        </svg>
        Add to Calendar
        <svg
          width="8" height="5" viewBox="0 0 8 5" fill="none"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
        >
          <path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            background: "rgba(250,249,246,0.98)",
            backdropFilter: "blur(8px)",
            border: "0.5px solid var(--border-strong)",
            boxShadow: "0 8px 24px rgba(42,42,40,0.1)",
            zIndex: 50,
            minWidth: "180px",
            overflow: "hidden",
          }}
        >
          <a
            href={buildGoogleCalendarUrl(eventTitle, eventDate)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            style={calendarOptionStyle}
          >
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Google Calendar
          </a>
          <div style={{ height: "0.5px", background: "var(--border)" }} />
          <a
            href={buildOutlookUrl(eventTitle, eventDate)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            style={calendarOptionStyle}
          >
            <svg width="14" height="14" viewBox="0 0 21 21" fill="none">
              <path d="M10 0H1v9h9V0z" fill="#F25022"/>
              <path d="M21 0h-9v9h9V0z" fill="#7FBA00"/>
              <path d="M10 11H1v9h9v-9z" fill="#00A4EF"/>
              <path d="M21 11h-9v9h9v-9z" fill="#FFB900"/>
            </svg>
            Outlook Calendar
          </a>
          <div style={{ height: "0.5px", background: "var(--border)" }} />
          <button
            onClick={() => {
              // Generate an ICS file for Apple Calendar / generic
              const date = new Date(eventDate);
              const dateStr = date.toISOString().split("T")[0].replace(/-/g, "");
              const ics = [
                "BEGIN:VCALENDAR",
                "VERSION:2.0",
                "PRODID:-//Korrin's Photos//EN",
                "BEGIN:VEVENT",
                `DTSTART;VALUE=DATE:${dateStr}`,
                `DTEND;VALUE=DATE:${dateStr}`,
                `SUMMARY:${eventTitle}`,
                `DESCRIPTION:Photography session managed via Korrin's Photos.`,
                "END:VEVENT",
                "END:VCALENDAR",
              ].join("\r\n");

              const blob = new Blob([ics], { type: "text/calendar" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${eventTitle.replace(/[^a-z0-9]/gi, "-")}.ics`;
              a.click();
              URL.revokeObjectURL(url);
              setOpen(false);
            }}
            style={{ ...calendarOptionStyle, background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="1" y="4" width="14" height="11" rx="1"/>
              <path d="M5 1v4M11 1v4M1 8h14"/>
            </svg>
            Apple / Other (.ics)
          </button>
        </div>
      )}
    </div>
  );
}

const calendarOptionStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
  padding: "0.7rem 1rem",
  fontSize: "0.75rem",
  color: "var(--charcoal)",
  textDecoration: "none",
  transition: "background 0.15s",
  fontFamily: "'Jost', sans-serif",
  letterSpacing: "0.03em",
};