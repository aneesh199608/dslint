import type { LibraryScope } from "./types";
import { getVariablesForScope, LOCAL_LIBRARY_OPTION } from "./libraries";

// Helpers for spacing variables (padding, etc.)

const resolveNumericValue = async (variable: Variable) => {
  const collection = await figma.variables.getVariableCollectionByIdAsync(
    variable.variableCollectionId
  );
  const modeId = collection?.defaultModeId ?? collection?.modes?.[0]?.modeId;
  if (!modeId) return null;
  const val = variable.valuesByMode[modeId];
  if (typeof val === "number") return val;
  if (typeof val === "object" && "type" in val && val.type === "VARIABLE_ALIAS") {
    const target = await figma.variables.getVariableByIdAsync(val.id);
    if (!target) return null;
    return resolveNumericValue(target);
  }
  return null;
};

const EPSILON = 1e-5;
export const DEFAULT_SPACING_TOLERANCE = 2;

export const findSpacingVariable = async (
  value: number,
  libraryScope: LibraryScope = LOCAL_LIBRARY_OPTION.scope
) => {
  const vars = await getVariablesForScope("FLOAT", libraryScope);
  for (const variable of vars) {
    const resolved = await resolveNumericValue(variable);
    if (resolved !== null && Math.abs(resolved - value) < EPSILON) {
      return variable;
    }
  }
  return null;
};

export const findNearestSpacingVariable = async (
  value: number,
  tolerance: number = DEFAULT_SPACING_TOLERANCE,
  libraryScope: LibraryScope = LOCAL_LIBRARY_OPTION.scope
) => {
  const vars = await getVariablesForScope("FLOAT", libraryScope);
  let best: { variable: Variable; diff: number } | null = null;

  for (const variable of vars) {
    const resolved = await resolveNumericValue(variable);
    if (resolved === null) continue;
    const diff = Math.abs(resolved - value);
    if (best === null || diff < best.diff) {
      best = { variable, diff };
    }
  }

  if (best && best.diff <= tolerance) {
    return best;
  }
  return null;
};
