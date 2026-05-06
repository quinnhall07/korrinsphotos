// app/loading.tsx
export default function Loading() {
  return (
    <div
      style={{
        paddingTop: "72px",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <div
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1.35rem",
            fontWeight: 500,
            color: "var(--charcoal)",
            letterSpacing: "0.04em",
            opacity: 0.4,
            animation: "pulse 1.6s ease-in-out infinite",
          }}
        >
          Korrin&apos;s Photography<span style={{ color: "var(--olive)" }}>.</span>
        </div>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.9; }
          }
        `}</style>
      </div>
    </div>
  );
}