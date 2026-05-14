"use client";

// app/admin/settings/automations/AutomationsForm.tsx
// Client component that renders the automation recipe cards and posts
// to the `saveAutomationConfig` Server Action. We deliberately use a
// plain `<form action={...}>` so FormData is the wire format — keeps
// the action signature minimal.

import { useTransition } from "react";
import { toast } from "@/components/ui/Toaster";
import { saveAutomationConfig } from "./actions";
import type {
  AutomationRecipe,
  RecipeParam,
  ResolvedAutomationConfig,
} from "@/lib/automations/recipes";

interface Props {
  recipes: AutomationRecipe[];
  resolved: ResolvedAutomationConfig;
}

export function AutomationsForm({ recipes, resolved }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await saveAutomationConfig(formData);
      if (result.success) {
        toast("Automation settings saved");
      } else {
        toast(result.error || "Failed to save automation settings");
      }
    });
  }

  return (
    <form action={handleSubmit}>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        {recipes.map((recipe) => (
          <RecipeCard
            key={recipe.key}
            recipe={recipe}
            enabled={resolved[recipe.key]?.enabled ?? recipe.defaultEnabled}
            params={resolved[recipe.key]?.params ?? {}}
          />
        ))}
      </ul>

      <div
        style={{
          marginTop: "2rem",
          display: "flex",
          justifyContent: "flex-end",
          gap: "0.75rem",
          alignItems: "center",
        }}
      >
        {isPending ? (
          <span
            style={{
              fontSize: "0.72rem",
              letterSpacing: "0.1em",
              color: "var(--charcoal-muted)",
            }}
          >
            Saving…
          </span>
        ) : null}
        <button
          type="submit"
          disabled={isPending}
          style={{
            background: "var(--olive)",
            color: "var(--white)",
            border: "0.5px solid var(--olive)",
            padding: "0.7rem 1.6rem",
            fontSize: "0.72rem",
            fontFamily: "'Jost', sans-serif",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            cursor: isPending ? "wait" : "pointer",
            transition: "var(--transition)",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          Save settings
        </button>
      </div>
    </form>
  );
}

function RecipeCard({
  recipe,
  enabled,
  params,
}: {
  recipe: AutomationRecipe;
  enabled: boolean;
  params: Record<string, unknown>;
}) {
  return (
    <li
      style={{
        border: "0.5px solid var(--border)",
        background: "var(--white)",
        padding: "1.25rem 1.4rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1.5rem",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 400,
              fontSize: "1.4rem",
              lineHeight: 1.2,
              color: "var(--charcoal)",
              marginBottom: "0.4rem",
            }}
          >
            {recipe.label}
          </h2>
          <p
            style={{
              fontSize: "0.82rem",
              lineHeight: 1.6,
              color: "var(--charcoal-light)",
            }}
          >
            {recipe.description}
          </p>
        </div>

        <ToggleSwitch recipeKey={recipe.key} defaultChecked={enabled} />
      </div>

      {recipe.params && recipe.params.length > 0 ? (
        <div
          style={{
            marginTop: "1rem",
            paddingTop: "1rem",
            borderTop: "0.5px solid var(--border)",
            display: "flex",
            flexWrap: "wrap",
            gap: "1.2rem",
          }}
        >
          {recipe.params.map((param) => (
            <ParamInput
              key={param.name}
              recipeKey={recipe.key}
              param={param}
              value={params[param.name]}
            />
          ))}
        </div>
      ) : null}
    </li>
  );
}

function ToggleSwitch({
  recipeKey,
  defaultChecked,
}: {
  recipeKey: string;
  defaultChecked: boolean;
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.55rem",
        cursor: "pointer",
        userSelect: "none",
        fontSize: "0.7rem",
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: "var(--charcoal-muted)",
      }}
    >
      <input
        type="checkbox"
        name={`enabled_${recipeKey}`}
        defaultChecked={defaultChecked}
        style={{
          width: 14,
          height: 14,
          accentColor: "var(--olive)",
          cursor: "pointer",
        }}
      />
      <span>On</span>
    </label>
  );
}

function ParamInput({
  recipeKey,
  param,
  value,
}: {
  recipeKey: string;
  param: RecipeParam;
  value: unknown;
}) {
  const inputName = `param_${recipeKey}_${param.name}`;
  const isNumeric =
    param.type === "number" || param.type === "days" || param.type === "hours";

  const unitSuffix =
    param.type === "days" ? "days" : param.type === "hours" ? "hours" : null;

  if (param.type === "select" && param.options) {
    return (
      <label
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.35rem",
          minWidth: 180,
        }}
      >
        <span
          style={{
            fontSize: "0.62rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
          }}
        >
          {param.label}
        </span>
        <select
          name={inputName}
          defaultValue={String(value ?? param.default)}
          style={selectStyle}
        >
          {param.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.35rem",
        minWidth: 140,
      }}
    >
      <span
        style={{
          fontSize: "0.62rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--charcoal-muted)",
        }}
      >
        {param.label}
      </span>
      <div style={{ position: "relative", display: "flex" }}>
        <input
          type={isNumeric ? "number" : "text"}
          name={inputName}
          defaultValue={
            value === undefined || value === null ? String(param.default) : String(value)
          }
          min={isNumeric ? 0 : undefined}
          step={isNumeric ? 1 : undefined}
          style={{
            ...inputStyle,
            paddingRight: unitSuffix ? "3.5rem" : "0.6rem",
          }}
        />
        {unitSuffix ? (
          <span
            style={{
              position: "absolute",
              right: "0.6rem",
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: "0.7rem",
              color: "var(--charcoal-muted)",
              pointerEvents: "none",
              letterSpacing: "0.1em",
            }}
          >
            {unitSuffix}
          </span>
        ) : null}
      </div>
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  border: "0.5px solid var(--border-strong)",
  background: "var(--white)",
  padding: "0.55rem 0.6rem",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.85rem",
  color: "var(--charcoal)",
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};
