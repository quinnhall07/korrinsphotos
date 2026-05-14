"use client";

// app/sign-contract/[id]/SigningForm.tsx
// Phase 1.7 — client-side signature capture with two modes:
//
//   1) "Draw" — HTML5 canvas, mouse + touch. Submitted as a base64 PNG
//      data URL alongside the typed name. Touch handlers use passive:false
//      so we can preventDefault() and stop the page from scrolling under
//      a finger drag.
//
//   2) "Type" — text input rendered in Cormorant Garamond italic. The
//      typed name becomes the signature; the canvas data URL is null.
//
// In both modes:
//   - the client supplies the contract id + the token from the URL
//     (passed in by the server page component);
//   - "I agree" checkbox + full legal name are mandatory;
//   - the server validates the token again before persisting.

import { useEffect, useRef, useState, useTransition } from "react";
import { submitSignature } from "./actions";

type Mode = "DRAW" | "TYPE";

type Props = {
  contractId: string;
  token: string;
};

export function SigningForm({ contractId, token }: Props) {
  const [mode, setMode] = useState<Mode>("DRAW");
  const [name, setName] = useState("");
  const [typedSignature, setTypedSignature] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  // `hasInk` is state, not a ref, because the render uses it to gate the
  // placeholder + the submit button. ESLint's react-hooks rule (rightly)
  // forbids reading refs in render.
  const [hasInk, setHasInk] = useState(false);

  // ─── Canvas wiring ────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Backing-store sizing: scale by DPR so strokes stay crisp on retina.
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#2A2A28";

    function pointFromEvent(e: PointerEvent): { x: number; y: number } {
      const r = canvas!.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function onDown(e: PointerEvent) {
      e.preventDefault();
      drawingRef.current = true;
      const p = pointFromEvent(e);
      lastPointRef.current = p;
      ctx!.beginPath();
      ctx!.moveTo(p.x, p.y);
      canvas!.setPointerCapture(e.pointerId);
    }
    function onMove(e: PointerEvent) {
      if (!drawingRef.current) return;
      e.preventDefault();
      const p = pointFromEvent(e);
      ctx!.lineTo(p.x, p.y);
      ctx!.stroke();
      lastPointRef.current = p;
      setHasInk((prev) => prev || true);
    }
    function onUp(e: PointerEvent) {
      if (!drawingRef.current) return;
      e.preventDefault();
      drawingRef.current = false;
      try {
        canvas!.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore — capture may already be released */
      }
    }

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, [mode]); // re-init when switching back to DRAW mode

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setHasInk(false);
  }

  // ─── Submission ───────────────────────────────────────────────────────────

  const hasDrawnSignature = mode === "DRAW" && hasInk;
  const hasTypedSignature = mode === "TYPE" && typedSignature.trim().length >= 2;
  const canSubmit =
    name.trim().length >= 2 &&
    agreed &&
    (hasDrawnSignature || hasTypedSignature) &&
    !isPending &&
    !signedAt;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);

    let signatureDataUrl: string | null = null;
    if (mode === "DRAW") {
      const canvas = canvasRef.current;
      if (canvas) {
        try {
          signatureDataUrl = canvas.toDataURL("image/png");
        } catch (err) {
          console.error("[SigningForm] canvas.toDataURL failed", err);
        }
      }
    }

    startTransition(async () => {
      const result = await submitSignature(contractId, token, {
        name: name.trim(),
        signatureDataUrl,
        typedName: mode === "TYPE" ? typedSignature.trim() : null,
        agreed,
      });
      if (result.success) {
        setSignedAt(result.signedAt ?? new Date().toLocaleString());
      } else {
        setError(result.error ?? "Unable to sign contract. Please try again.");
      }
    });
  }

  // ─── Post-sign confirmation ──────────────────────────────────────────────

  if (signedAt) {
    return (
      <div
        style={{
          borderLeft: "2px solid var(--olive)",
          padding: "1.75rem 2rem",
          background: "var(--olive-dim)",
        }}
      >
        <p
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
            marginBottom: "0.6rem",
          }}
        >
          Signed
        </p>
        <p
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1.8rem",
            fontWeight: 300,
            fontStyle: "italic",
            lineHeight: 1.2,
            marginBottom: "0.4rem",
          }}
        >
          {name}
        </p>
        <p style={{ fontSize: "0.82rem", color: "var(--charcoal-muted)" }}>
          Signed on {signedAt}
        </p>
        <p
          style={{
            marginTop: "1.25rem",
            fontSize: "0.88rem",
            color: "var(--charcoal-light)",
            lineHeight: 1.7,
          }}
        >
          Thank you. A copy has been archived and Korrin has been notified.
        </p>
      </div>
    );
  }

  // ─── Form ────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} noValidate>
      <p
        style={{
          fontSize: "0.65rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--olive)",
          marginBottom: "0.75rem",
        }}
      >
        Electronic Signature
      </p>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Signature mode"
        style={{
          display: "flex",
          gap: "0",
          borderBottom: "0.5px solid var(--border-strong)",
          marginBottom: "1.5rem",
        }}
      >
        <TabButton
          active={mode === "DRAW"}
          onClick={() => setMode("DRAW")}
          disabled={isPending}
        >
          Draw signature
        </TabButton>
        <TabButton
          active={mode === "TYPE"}
          onClick={() => setMode("TYPE")}
          disabled={isPending}
        >
          Type signature
        </TabButton>
      </div>

      {/* Canvas */}
      {mode === "DRAW" && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              position: "relative",
              border: "0.5px solid var(--border-strong)",
              background: "var(--white)",
              height: "180px",
              touchAction: "none",
            }}
          >
            <canvas
              ref={canvasRef}
              style={{
                width: "100%",
                height: "100%",
                display: "block",
                cursor: "crosshair",
              }}
              aria-label="Signature canvas"
            />
            {!hasInk && (
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                  color: "var(--charcoal-muted)",
                  fontSize: "0.85rem",
                  letterSpacing: "0.04em",
                }}
              >
                Sign with your mouse or finger
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={clearCanvas}
            disabled={isPending}
            style={{
              marginTop: "0.6rem",
              padding: "0.45rem 1.2rem",
              fontSize: "0.68rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              background: "transparent",
              color: "var(--charcoal-muted)",
              border: "0.5px solid var(--border-strong)",
              cursor: "pointer",
              fontFamily: "'Jost', sans-serif",
            }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Typed signature */}
      {mode === "TYPE" && (
        <div style={{ marginBottom: "1.5rem" }}>
          <label
            htmlFor="typed-signature"
            style={{
              display: "block",
              fontSize: "0.78rem",
              color: "var(--charcoal-light)",
              marginBottom: "0.5rem",
              letterSpacing: "0.02em",
            }}
          >
            Type your signature
          </label>
          <input
            id="typed-signature"
            type="text"
            className="form-input"
            value={typedSignature}
            onChange={(e) => setTypedSignature(e.target.value)}
            placeholder="Your signature"
            autoComplete="off"
            spellCheck={false}
            disabled={isPending}
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "1.8rem",
              fontStyle: "italic",
              fontWeight: 300,
              padding: "0.9rem 1rem",
              width: "100%",
              border: "0.5px solid var(--border-strong)",
              background: "var(--white)",
            }}
          />
        </div>
      )}

      {/* Full legal name */}
      <label
        htmlFor="signature-name"
        style={{
          display: "block",
          fontSize: "0.78rem",
          color: "var(--charcoal-light)",
          marginBottom: "0.5rem",
          letterSpacing: "0.02em",
        }}
      >
        Full legal name
      </label>
      <input
        id="signature-name"
        type="text"
        className="form-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Full name"
        autoComplete="name"
        spellCheck={false}
        disabled={isPending}
        style={{
          fontSize: "1rem",
          padding: "0.75rem 1rem",
          marginBottom: "1.5rem",
          width: "100%",
          border: "0.5px solid var(--border-strong)",
          background: "var(--white)",
        }}
      />

      <label
        style={{
          display: "flex",
          gap: "0.75rem",
          alignItems: "flex-start",
          marginBottom: "2rem",
          cursor: "pointer",
          fontSize: "0.88rem",
          color: "var(--charcoal-light)",
          lineHeight: 1.6,
        }}
      >
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          disabled={isPending}
          style={{
            marginTop: "0.25rem",
            width: "14px",
            height: "14px",
            accentColor: "var(--olive)",
            flexShrink: 0,
          }}
        />
        <span>
          I agree this constitutes my electronic signature, and that I have read and accept the terms of this contract.
        </span>
      </label>

      {error && (
        <div
          style={{
            padding: "0.85rem 1rem",
            background: "#FEF3C7",
            borderLeft: "2px solid #F59E0B",
            fontSize: "0.82rem",
            color: "#92400E",
            marginBottom: "1.5rem",
            lineHeight: 1.6,
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        style={{
          display: "inline-block",
          padding: "0.95rem 2.6rem",
          fontSize: "0.72rem",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          background: canSubmit ? "var(--olive)" : "var(--charcoal-muted)",
          color: "var(--white)",
          border: "none",
          cursor: canSubmit ? "pointer" : "not-allowed",
          transition: "background 0.2s",
          fontFamily: "'Jost', sans-serif",
        }}
      >
        {isPending ? "Signing..." : "Sign Contract"}
      </button>
    </form>
  );
}

function TabButton({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "0.75rem 1.5rem",
        fontSize: "0.7rem",
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        background: "transparent",
        color: active ? "var(--charcoal)" : "var(--charcoal-muted)",
        border: "none",
        borderBottom: active ? "1.5px solid var(--olive)" : "1.5px solid transparent",
        marginBottom: "-0.5px",
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "'Jost', sans-serif",
        fontWeight: active ? 500 : 400,
        transition: "color 0.2s, border-color 0.2s",
      }}
    >
      {children}
    </button>
  );
}
