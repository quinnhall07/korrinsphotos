// lib/automations/recipes.ts
//
// Phase 1.9: replace hardcoded magic numbers in `lib/project-transitions.ts`
// with a small catalog of "recipes" the admin can toggle and tune from
// `/admin/settings/automations`. The catalog is the source of truth for the
// 8 named recipes, their default parameters, and the human-readable copy
// that drives the settings UI.
//
// IMPORTANT: recipe keys are persisted in `users/{uid}.automationConfig` and
// MUST remain stable. Add new recipes by appending; never rename or remove
// existing keys without a data migration.

import type {
  AutomationConfigEntry,
  AutomationConfigMap,
} from "@/lib/db/users";
import { getFirstAdminUser } from "@/lib/db/users";

// ─── Recipe schema ───────────────────────────────────────────────────────────

export type RecipeParamType = "number" | "days" | "hours" | "select";

export interface RecipeParam {
  /** Stable parameter name. Used as the JSON key in `paramsJson`. */
  name: string;
  /** UI control type. */
  type: RecipeParamType;
  /** Default value when the user has not set one. */
  default: unknown;
  /** Options for `type === "select"`. */
  options?: string[];
  /** Human-readable label for the input. */
  label: string;
}

export interface AutomationRecipe {
  /** Stable persisted key — do not change. */
  key: string;
  /** Human-readable title for the settings card. */
  label: string;
  /** Plain-English description of what the recipe does. */
  description: string;
  /** Whether the recipe runs by default if the admin has no override. */
  defaultEnabled: boolean;
  /** Optional tunable parameters. Omit for pure on/off toggles. */
  params?: RecipeParam[];
}

// ─── Catalog ─────────────────────────────────────────────────────────────────
//
// 8 named recipes covering the lifecycle hooks Korrin actually uses. The
// roadmap (§1.9) caps this at 5–8 and explicitly warns against a visual
// canvas — so each entry here is small, named, and individually tunable.

export const AUTOMATION_RECIPES: AutomationRecipe[] = [
  {
    key: "referral_send_after_delivery",
    label: "Referral ask after gallery delivery",
    description:
      "Queues the $150 referral email N days after a project enters GALLERY_DELIVERED. The cron worker picks it up and sends via the mail/ queue.",
    defaultEnabled: true,
    params: [
      { name: "delay_days", type: "days", default: 7, label: "Delay (days)" },
    ],
  },
  {
    key: "auto_follow_up_proposal",
    label: "Auto follow-up: proposal sent",
    description:
      "Queues a nudge task N days after PROPOSAL_SENT so stale proposals don't go cold.",
    defaultEnabled: true,
    params: [
      { name: "delay_days", type: "days", default: 3, label: "Delay (days)" },
    ],
  },
  {
    key: "auto_follow_up_contract",
    label: "Auto follow-up: contract sent",
    description:
      "Queues a nudge task N days after CONTRACT_SENT to chase the signature.",
    defaultEnabled: true,
    params: [
      { name: "delay_days", type: "days", default: 3, label: "Delay (days)" },
    ],
  },
  {
    key: "auto_follow_up_deposit",
    label: "Auto follow-up: deposit pending",
    description:
      "Queues a nudge task N days after DEPOSIT_PENDING to chase the deposit invoice.",
    defaultEnabled: true,
    params: [
      { name: "delay_days", type: "days", default: 3, label: "Delay (days)" },
    ],
  },
  {
    key: "auto_create_balance_invoice",
    label: "Auto-create balance invoice",
    description:
      "Creates the remaining-balance invoice (50% of the package price) when a project advances into BOOKED. Roadmap intent: move this to IN_EDITING once the editing handoff lands; toggle covers both.",
    defaultEnabled: true,
  },
  {
    key: "auto_send_questionnaire",
    label: "Auto-send client questionnaire",
    description:
      "Sends the session-type questionnaire email when a project enters BOOKED. Disable if you prefer to hand-send.",
    defaultEnabled: true,
  },
  {
    key: "auto_send_welcome_packet",
    label: "Auto-send welcome packet",
    description:
      "Sends the welcome packet (logistics + style guide PDF) when a project enters BOOKED. Currently a placeholder until the PDF generator ships — toggle still controls whether it fires.",
    defaultEnabled: false,
  },
  {
    key: "sneak_peek_drop_hours",
    label: "Sneak-peek email after shoot",
    description:
      "Schedules a one-photo sneak-peek email N hours after the shootDate. Keeps clients excited while the full gallery is being edited.",
    defaultEnabled: true,
    params: [
      {
        name: "delay_hours",
        type: "hours",
        default: 48,
        label: "Delay (hours)",
      },
    ],
  },
];

// Convenience lookup.
const RECIPE_BY_KEY: Map<string, AutomationRecipe> = new Map(
  AUTOMATION_RECIPES.map((r) => [r.key, r])
);

export function getRecipe(key: string): AutomationRecipe | undefined {
  return RECIPE_BY_KEY.get(key);
}

// ─── Effective config ────────────────────────────────────────────────────────

/**
 * Resolved view of a recipe: whether it's enabled and its concrete
 * parameter values, with defaults applied for any keys the user hasn't
 * touched.
 */
export interface ResolvedRecipe {
  key: string;
  enabled: boolean;
  params: Record<string, unknown>;
}

export type ResolvedAutomationConfig = Record<string, ResolvedRecipe>;

function defaultParamsFor(recipe: AutomationRecipe): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of recipe.params ?? []) {
    out[p.name] = p.default;
  }
  return out;
}

function parseParams(entry: AutomationConfigEntry | undefined): Record<string, unknown> {
  if (!entry?.paramsJson) return {};
  try {
    const parsed = JSON.parse(entry.paramsJson);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Merge a stored `automationConfig` map with the catalog defaults.
 * Always returns an entry for every recipe in the catalog, even if the
 * user has never saved anything.
 */
export function resolveAutomationConfig(
  stored: AutomationConfigMap | undefined
): ResolvedAutomationConfig {
  const out: ResolvedAutomationConfig = {};
  for (const recipe of AUTOMATION_RECIPES) {
    const entry = stored?.[recipe.key];
    const enabled = entry?.enabled ?? recipe.defaultEnabled;
    const params = { ...defaultParamsFor(recipe), ...parseParams(entry) };
    out[recipe.key] = { key: recipe.key, enabled, params };
  }
  return out;
}

/**
 * Server-side helper used by `lib/project-transitions.ts` to read the
 * effective automation config at hook time.
 *
 * LIMITATION (v1): project transitions don't currently know which admin
 * UID triggered them — Stripe webhooks fire from no user, cron runs from
 * no user, and manual status changes don't thread the uid through. So
 * for now we look up the first admin user and treat their config as the
 * single source of truth. This works because Korrin's Photos has a
 * single admin (Korrin). When multi-admin support arrives we'll need to
 * either attach an `automationOwnerUid` to each project or move the
 * config to a tenant-scoped doc.
 *
 * If no admin user exists yet (fresh install, first boot), we fall back
 * to catalog defaults so existing transition behavior is preserved.
 */
export async function getEffectiveAutomationConfig(): Promise<ResolvedAutomationConfig> {
  let stored: AutomationConfigMap | undefined;
  try {
    const admin = await getFirstAdminUser();
    stored = admin?.automationConfig;
  } catch (err) {
    // Best-effort: if the user lookup fails, fall back to defaults so
    // we never break a project transition because the config read died.
    console.error("[getEffectiveAutomationConfig] admin lookup failed", err);
  }
  return resolveAutomationConfig(stored);
}

// ─── Param coercion helpers (used by the UI Server Action) ───────────────────

/**
 * Coerce a raw form value into the type declared by the param spec.
 * Returns the param's default if the value can't be parsed.
 */
export function coerceParamValue(param: RecipeParam, raw: unknown): unknown {
  switch (param.type) {
    case "number":
    case "days":
    case "hours": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) return param.default;
      // Days/hours can't be negative.
      if ((param.type === "days" || param.type === "hours") && n < 0) {
        return param.default;
      }
      return n;
    }
    case "select": {
      const s = typeof raw === "string" ? raw : String(raw ?? "");
      if (param.options && !param.options.includes(s)) return param.default;
      return s;
    }
  }
}

/**
 * Helper for the transition hooks: read a single numeric param for a
 * recipe, falling back to the recipe's default if anything is off.
 */
export function readNumberParam(
  config: ResolvedAutomationConfig,
  recipeKey: string,
  paramName: string,
  fallback: number
): number {
  const resolved = config[recipeKey];
  if (!resolved) return fallback;
  const v = resolved.params[paramName];
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function isRecipeEnabled(
  config: ResolvedAutomationConfig,
  recipeKey: string
): boolean {
  const resolved = config[recipeKey];
  if (!resolved) {
    // Unknown key — fall back to the catalog default so we don't silently
    // disable a hook because of a typo at the call site.
    return getRecipe(recipeKey)?.defaultEnabled ?? false;
  }
  return resolved.enabled;
}
