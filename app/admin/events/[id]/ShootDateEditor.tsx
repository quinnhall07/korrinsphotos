// app/admin/events/[id]/ShootDateEditor.tsx
// Inline date editor for shoot date(s) on event detail page.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateShootDates, updateEventStatus } from "./actions";
import { toast } from "@/components/ui/Toaster";

interface ShootDateEditorProps {
  eventId: string;
  initialStartDate: string;
  initialEndDate: string;
  initialStartTime: string;
  initialEndTime: string;
  initialIsMultiDay: boolean;
  initialLocation: string;
  initialStatus: "UPCOMING" | "COMPLETED";
}

export function ShootDateEditor({ 
  eventId, 
  initialStartDate, 
  initialEndDate,
  initialStartTime,
  initialEndTime,
  initialIsMultiDay,
  initialLocation,
  initialStatus
}: ShootDateEditorProps) {
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [isMultiDay, setIsMultiDay] = useState(initialIsMultiDay);
  const [location, setLocation] = useState(initialLocation);
  const [status, setStatus] = useState(initialStatus);

  const [, startTransition] = useTransition();
  const router = useRouter();

  function handleSave() {
    startTransition(async () => {
      await updateShootDates(eventId, {
        startDate: startDate || null,
        endDate: isMultiDay ? (endDate || null) : (startDate || null),
        startTime: startTime || null,
        endTime: endTime || null,
        isMultiDay,
        location: location || null,
      });
      toast("Event details updated ✓");
      router.refresh();
    });
  }

  function handleStatusToggle() {
    const newStatus = status === "UPCOMING" ? "COMPLETED" : "UPCOMING";
    startTransition(async () => {
      await updateEventStatus(eventId, newStatus);
      setStatus(newStatus);
      toast(`Event marked as ${newStatus} ✓`);
      if (newStatus === "COMPLETED") {
         toast("Please follow up on invoice resolution.");
      }
      router.refresh();
    });
  }

  return (
    <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      
      {/* Status Toggle & General Details */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <button
          onClick={handleStatusToggle}
          style={{
            padding: "0.4rem 0.8rem",
            fontSize: "0.62rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            background: status === "COMPLETED" ? "var(--olive)" : "var(--charcoal)",
            color: "var(--white)",
            border: "none",
            cursor: "pointer",
            fontFamily: "'Jost', sans-serif",
            borderRadius: "4px"
          }}
        >
          {status === "COMPLETED" ? "Completed ✓" : "Upcoming"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
           <label style={labelStyle}>Location</label>
           <input
             type="text"
             value={location}
             onChange={(e) => setLocation(e.target.value)}
             style={{...dateInputStyle, width: "200px"}}
             placeholder="Studio, Park, etc."
           />
        </div>
      </div>

      {/* Date & Time Configuration */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", background: "rgba(0,0,0,0.02)", padding: "0.75rem", borderRadius: "4px", border: "1px solid rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginRight: "1rem" }}>
          <input 
             type="checkbox" 
             id={`multiDay-${eventId}`}
             checked={isMultiDay} 
             onChange={(e) => setIsMultiDay(e.target.checked)} 
          />
          <label htmlFor={`multiDay-${eventId}`} style={labelStyle}>Multi-day</label>
        </div>

        <label style={labelStyle}>{isMultiDay ? "Start date" : "Date"}</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          style={dateInputStyle}
        />
        
        {isMultiDay && (
          <>
            <label style={labelStyle}>End date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={dateInputStyle}
            />
          </>
        )}

        <label style={labelStyle}>Time</label>
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          style={dateInputStyle}
        />
        <label style={labelStyle}>to</label>
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          style={dateInputStyle}
        />

        <button
          onClick={handleSave}
          style={{
            padding: "0.4rem 0.8rem",
            fontSize: "0.62rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            background: "var(--charcoal)",
            color: "var(--white)",
            border: "none",
            cursor: "pointer",
            fontFamily: "'Jost', sans-serif",
            marginLeft: "auto"
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: "0.68rem",
  color: "var(--charcoal-muted)",
  fontFamily: "'Jost', sans-serif",
};

const dateInputStyle: React.CSSProperties = {
  border: "0.5px solid var(--border-strong)",
  background: "var(--white)",
  padding: "0.4rem 0.6rem",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.78rem",
  color: "var(--charcoal)",
  outline: "none",
};
