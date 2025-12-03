import { colorsEqual, rgbDistanceSq } from "./colors";
import type { ModePreference } from "./types";

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
): Promise<RGB | null> => {
  if (variable.resolvedType !== "COLOR") return null;

  const resolveValue = async (
    value: VariableValue,
    preferredName: ModePreference,
    fallbackModeId: string
  ): Promise<RGB | null> => {
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
    return typeof color.r === "number" ? { r: color.r, g: color.g, b: color.b } : null;
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
  preferredModeName: ModePreference
) => {
  const variables = await figma.variables.getLocalVariablesAsync("COLOR");
  const exactMatches: { variable: Variable; isMulti: boolean }[] = [];
  let bestMulti: { variable: Variable; distance: number } | null = null;
  let bestSingle: { variable: Variable; distance: number } | null = null;

  for (const variable of variables) {
    const collection = await figma.variables.getVariableCollectionByIdAsync(
      variable.variableCollectionId
    );
    if (!collection) continue;

    const variableColor = await resolveColorForMode(variable, preferredModeName);
    if (!variableColor) continue;

    const isMultiMode = collection.modes.length > 1;

    if (colorsEqual(variableColor, color)) {
      exactMatches.push({ variable, isMulti: isMultiMode });
      continue;
    }

    const distance = rgbDistanceSq(color, variableColor);
    if (isMultiMode) {
      if (!bestMulti || distance < bestMulti.distance) bestMulti = { variable, distance };
    } else {
      if (!bestSingle || distance < bestSingle.distance) bestSingle = { variable, distance };
    }
  }

  if (exactMatches.length === 1) return exactMatches[0].variable;
  if (exactMatches.length > 1) {
    const multi = exactMatches.find((m) => m.isMulti);
    return (multi ?? exactMatches[0]).variable;
  }

  return (bestMulti ?? bestSingle)?.variable ?? null;
};
