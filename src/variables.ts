import { colorsEqual, rgbDistanceSq, type RGBA } from "./colors";
import type { LibraryScope, ModePreference } from "./types";
import { getVariablesForScope, LOCAL_LIBRARY_OPTION } from "./libraries";

const pickModeId = (
  collection: VariableCollection,
  preferredModeName: ModePreference
): string | null => {
  return (
    collection.modes.find(
      (mode) => mode.name.toLowerCase() === preferredModeName.toLowerCase()
    )?.modeId ??
    collection.modes.find((mode) => mode.modeId === collection.defaultModeId)?.modeId ??
    collection.modes[0]?.modeId ??
    null
  );
};

export const resolveColorForMode = async (
  variable: Variable,
  preferredModeName: ModePreference
): Promise<RGBA | null> => {
  if (variable.resolvedType !== "COLOR") return null;

  const resolveValue = async (
    value: VariableValue,
    preferredName: ModePreference,
    fallbackModeId: string
  ): Promise<RGBA | null> => {
    if (typeof value === "object" && "type" in value && value.type === "VARIABLE_ALIAS") {
      const target = await figma.variables.getVariableByIdAsync(value.id);
      if (!target) return null;
      const targetCollection = await figma.variables.getVariableCollectionByIdAsync(
        target.variableCollectionId
      );
      if (!targetCollection) return null;
      const targetModeId = pickModeId(targetCollection, preferredName) ?? fallbackModeId;
      const next = target.valuesByMode[targetModeId];
      return next ? resolveValue(next, preferredName, targetModeId) : null;
    }
    const color = value as RGB & { a?: number };
    return typeof color.r === "number"
      ? { r: color.r, g: color.g, b: color.b, a: color.a ?? 1 }
      : null;
  };

  const collection = await figma.variables.getVariableCollectionByIdAsync(
    variable.variableCollectionId
  );
  if (!collection) return null;
  const modeId = pickModeId(collection, preferredModeName);
  if (!modeId) return null;

  const modeValue = variable.valuesByMode[modeId];
  if (!modeValue) return null;
  return resolveValue(modeValue, preferredModeName, modeId);
};

export const findNearestColorVariable = async (
  color: RGB,
  opacity: number,
  preferredModeName: ModePreference,
  libraryScope: LibraryScope = LOCAL_LIBRARY_OPTION.scope
) => {
  // Be lenient on opacity matching so very low opacities (e.g. 0.1%) still match.
  // Clamp in case Figma returns an undefined opacity (defaults to 1).
  const paintAlpha = Math.min(1, Math.max(0, opacity ?? 1));
  const alphaEps = 2e-2;
  const alphaWeight = 4; // weight alpha difference in the distance score
  const variables = await getVariablesForScope("COLOR", libraryScope);
  const exactMatches: { variable: Variable; isMulti: boolean }[] = [];
  let bestMulti: { variable: Variable; score: number; alphaDelta: number } | null = null;
  let bestSingle: { variable: Variable; score: number; alphaDelta: number } | null = null;

  for (const variable of variables) {
    const collection = await figma.variables.getVariableCollectionByIdAsync(
      variable.variableCollectionId
    );
    if (!collection) continue;

    const variableColor = await resolveColorForMode(variable, preferredModeName);
    if (!variableColor) continue;

    const isMultiMode = collection.modes.length > 1;

    const variableAlpha = variableColor.a ?? 1;
    const alphaDelta = Math.abs(variableAlpha - paintAlpha);

    // We already gate on alphaDelta; compare channels while respecting the paint's opacity
    // (opacity lives on the paint, not the color object).
    if (alphaDelta <= alphaEps && colorsEqual(variableColor, color, 1, paintAlpha)) {
      exactMatches.push({ variable, isMulti: isMultiMode });
      continue;
    }

    const distance = rgbDistanceSq(color, variableColor, paintAlpha, variableAlpha);
    // Penalize opacity differences but never hard-reject; this keeps us from missing
    // low-alpha tokens while still preferring close matches.
    const alphaPenalty = alphaDelta * alphaWeight;
    const score = distance + alphaPenalty;
    if (isMultiMode) {
      if (!bestMulti || score < bestMulti.score) bestMulti = { variable, score, alphaDelta };
    } else {
      if (!bestSingle || score < bestSingle.score) bestSingle = { variable, score, alphaDelta };
    }
  }

  if (exactMatches.length === 1) return exactMatches[0].variable;
  if (exactMatches.length > 1) {
    const multi = exactMatches.find((m) => m.isMulti);
    return (multi ?? exactMatches[0]).variable;
  }

  const winner = bestMulti ?? bestSingle;
  // Avoid applying a clearly wrong token when opacity is far off (e.g., 0.1% vs 100%).
  const alphaHardCap = 0.25; // absolute alpha difference allowed when we only have fuzzy matches
  if (winner && winner.alphaDelta > alphaHardCap) return null;

  return winner?.variable ?? null;
};
