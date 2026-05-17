"use client";

// app/admin/settings/tax/TaxSettingsForm.tsx
// Phase 3.11 — Form for the admin tax configuration. Renders a master
// switch, the default state, and an override row per state.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import { saveTaxConfigAction } from "./actions";

export interface StateRuleProp {
  stateCode: string;
  ratePct: number;
  digitalPhotosTaxable: boolean;
  printsTaxable: boolean;
  filingFrequency: "MONTHLY" | "QUARTERLY";
  filingDueDayOfMonth: number;
  notes?: string;
  // Effective (post-override) values for initial form state.
  effectiveRatePct: number;
  effectiveDigital: boolean;
  effectivePrints: boolean;
}

interface Props {
  collectSalesTax: boolean;
  defaultBusinessStateCode: string;
  rules: StateRuleProp[];
}

export function TaxSettingsForm({
  collectSalesTax,
  defaultBusinessStateCode,
  rules,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [collect, setCollect] = useState(collectSalesTax);
  const [defaultState, setDefaultState] = useState(defaultBusinessStateCode);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const r = await saveTaxConfigAction(formData);
      if (r.success) {
        toast("Tax settings saved.");
        router.refresh();
      } else {
        toast(r.error || "Failed.");
      }
    });
  }

  const th: React.CSSProperties = {
    textAlign: "left",
    fontSize: "0.66rem",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "var(--charcoal-muted)",
    padding: "0.5rem 0.6rem",
    borderBottom: "0.5px solid var(--border)",
    fontWeight: 500,
  };
  const td: React.CSSProperties = {
    fontSize: "0.82rem",
    color: "var(--charcoal)",
    padding: "0.6rem 0.6rem",
    borderBottom: "0.5px solid var(--border)",
  };

  return (
    <form action={onSubmit} className="page-fade-in" style={{ maxWidth: 980 }}>
      <header style={{ marginBottom: "2rem" }}>
        <p
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
            marginBottom: "0.5rem",
          }}
        >
          Settings · Tax
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 300,
            fontSize: "2.4rem",
            lineHeight: 1.1,
            color: "var(--charcoal)",
            marginBottom: "0.75rem",
          }}
        >
          Sales tax <em>settings</em>
        </h1>
        <p
          style={{
            fontSize: "0.88rem",
            lineHeight: 1.65,
            color: "var(--charcoal-light)",
            maxWidth: 720,
          }}
        >
          Master switch + per-state overrides for the sales-tax engine. New
          invoices use these values when they are generated.
        </p>
      </header>

      <section style={{ marginBottom: "2rem", padding: "1.2rem", border: "0.5px solid var(--border)", background: "var(--white)" }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            cursor: "pointer",
            marginBottom: "1rem",
          }}
        >
          <input
            type="checkbox"
            name="collectSalesTax"
            checked={collect}
            onChange={(e) => setCollect(e.target.checked)}
          />
          <span style={{ fontSize: "0.95rem", color: "var(--charcoal)" }}>
            Collect sales tax on invoices
          </span>
        </label>
        <label style={{ display: "block", marginTop: "0.5rem" }}>
          <span
            style={{
              fontSize: "0.7rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--charcoal-muted)",
              marginBottom: "0.3rem",
              display: "block",
            }}
          >
            Default business state
          </span>
          <input
            name="defaultBusinessStateCode"
            value={defaultState}
            onChange={(e) => setDefaultState(e.target.value.toUpperCase().slice(0, 2))}
            maxLength={2}
            style={{
              fontSize: "0.9rem",
              padding: "0.45rem 0.6rem",
              border: "0.5px solid var(--border-strong)",
              background: "var(--white)",
              width: "5rem",
              letterSpacing: "0.1em",
            }}
          />
          <span style={{ fontSize: "0.75rem", color: "var(--charcoal-muted)", marginLeft: "0.75rem" }}>
            Used when a client and project have no state on file.
          </span>
        </label>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1.3rem",
            color: "var(--charcoal)",
            marginBottom: "0.75rem",
          }}
        >
          Per-state rules
        </h2>
        <p
          style={{
            fontSize: "0.78rem",
            color: "var(--charcoal-muted)",
            marginBottom: "0.75rem",
          }}
        >
          Override the seeded base rate or taxability if your local rules differ.
          Leave the rate field blank to keep the seeded value.
        </p>
        <div style={{ border: "0.5px solid var(--border)", background: "var(--white)", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>State</th>
                <th style={th}>Filing</th>
                <th style={th}>Base Rate</th>
                <th style={th}>Override Rate %</th>
                <th style={th}>Digital Taxable</th>
                <th style={th}>Prints Taxable</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.stateCode}>
                  <td style={td}>{r.stateCode}</td>
                  <td style={td}>
                    {r.filingFrequency.toLowerCase()} · day {r.filingDueDayOfMonth}
                  </td>
                  <td style={td}>{r.ratePct.toFixed(2)}%</td>
                  <td style={td}>
                    <input
                      type="number"
                      name={`override_${r.stateCode}_ratePct`}
                      defaultValue={r.effectiveRatePct.toFixed(2)}
                      step="0.01"
                      min="0"
                      max="25"
                      style={{
                        width: "5rem",
                        fontSize: "0.8rem",
                        padding: "0.3rem 0.4rem",
                        border: "0.5px solid var(--border-strong)",
                        background: "var(--white)",
                      }}
                    />
                  </td>
                  <td style={td}>
                    <input
                      type="checkbox"
                      name={`override_${r.stateCode}_digital`}
                      defaultChecked={r.effectiveDigital}
                    />
                  </td>
                  <td style={td}>
                    <input
                      type="checkbox"
                      name={`override_${r.stateCode}_prints`}
                      defaultChecked={r.effectivePrints}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="submit"
          disabled={pending}
          style={{
            fontSize: "0.78rem",
            padding: "0.6rem 1.4rem",
            background: "var(--charcoal)",
            color: "var(--white)",
            border: "none",
            cursor: pending ? "default" : "pointer",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {pending ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
