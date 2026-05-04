// app/admin/events/[id]/loading.tsx
export default function Loading() {
  return (
    <div style={{ paddingTop: "72px", minHeight: "100vh" }}>
      <div style={{ padding: "3rem 3.5rem" }}>
        {/* Breadcrumb skeleton */}
        <div className="skeleton" style={{ height: "0.8rem", width: "18rem", marginBottom: "1rem" }} />
        {/* Title skeleton */}
        <div className="skeleton" style={{ height: "2rem", width: "28rem", marginBottom: "0.5rem" }} />
        <div className="skeleton" style={{ height: "1rem", width: "20rem", marginBottom: "3rem" }} />

        {/* Upload card */}
        <div style={{ border: "0.5px solid var(--border)", marginBottom: "2rem" }}>
          <div style={{ padding: "1.2rem 1.5rem", borderBottom: "0.5px solid var(--border)" }}>
            <div className="skeleton" style={{ height: "1rem", width: "10rem" }} />
          </div>
          <div className="skeleton" style={{ height: "180px", margin: "1.5rem" }} />
        </div>

        {/* Photo grid skeleton */}
        <div style={{ border: "0.5px solid var(--border)" }}>
          <div style={{ padding: "1.2rem 1.5rem", borderBottom: "0.5px solid var(--border)" }}>
            <div className="skeleton" style={{ height: "1rem", width: "12rem" }} />
          </div>
          <div style={{ padding: "1rem", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.75rem" }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ aspectRatio: "1" }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}