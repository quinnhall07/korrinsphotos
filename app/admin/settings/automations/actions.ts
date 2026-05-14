"use server";

// app/admin/settings/automations/actions.ts
// Server Action for the automation recipes settings page (Phase 1.9).
//
// The form posts one hidden field per recipe — `enabled_<recipeKey>` — plus
// one hidden field per param — `param_<recipeKey>_<paramName>`. We coerce
// each value through `coerceParamValue` so a typo in a number input can't
// poison the persisted config; if coercion fails we silently fall back to
// the recipe's default.

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { logActivity } from "@/lib/db/activity";
import {
  updateUserAutomationConfig,
  type AutomationConfigMap,
} from "@/lib/db/users";
import {
  AUTOMATION_RECIPES,
  coerceParamValue,
} from "@/lib/automations/recipes";

export type SaveAutomationResult =
  | { success: true }
  | { success: false; error: string };

export async function saveAutomationConfig(
  formData: FormData
): Promise<SaveAutomationResult> {
  const session = await requireAdmin();

  try {
    const next: AutomationConfigMap = {};

    for (const recipe of AUTOMATION_RECIPES) {
      // Checkbox "on" if present in formData, otherwise off.
      const enabled = formData.get(`enabled_${recipe.key}`) === "on";

      let paramsJson: string | undefined;
      if (recipe.params && recipe.params.length > 0) {
        const params: Record<string, unknown> = {};
        for (const param of recipe.params) {
          const raw = formData.get(`param_${recipe.key}_${param.name}`);
          params[param.name] = coerceParamValue(param, raw);
        }
        paramsJson = JSON.stringify(params);
      }

      next[recipe.key] = paramsJson
        ? { enabled, paramsJson }
        : { enabled };
    }

    await updateUserAutomationConfig(session.uid, next);

    await logActivity(
      "NOTE_ADDED",
      "Automation recipe settings updated",
      { uid: session.uid }
    ).catch(() => {});

    revalidatePath("/admin/settings/automations");

    return { success: true };
  } catch (err) {
    console.error("saveAutomationConfig error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save settings.",
    };
  }
}
