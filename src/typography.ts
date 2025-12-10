import type { ModePreference } from "./types";

type TypographyValue = {
  fontFamily?: string;
  fontSize?: number;
  fontStyle?: string;
  lineHeight?: { unit: "PIXELS" | "PERCENT" | "AUTO"; value?: number };
};

const isTextNode = (node: SceneNode): node is TextNode => node.type === "TEXT";

const normalizeLineHeight = (lineHeight?: LineHeight): TypographyValue["lineHeight"] => {
  if (!lineHeight) return undefined;
  if (lineHeight.unit === "AUTO") {
    return { unit: "AUTO" };
  }
  return { unit: lineHeight.unit, value: lineHeight.value };
};

const getNodeTypography = (node: TextNode): TypographyValue | null => {
  // Only handle uniform text styling for now.
  if (node.hasMissingFont) return null;
  if (node.fontName === figma.mixed) return null;
  if (node.fontSize === figma.mixed) return null;
  if (node.lineHeight === figma.mixed) return null;

  const fontName = node.fontName as FontName;
  const lineHeight = node.lineHeight as LineHeight | undefined;

  return {
    fontFamily: fontName.family,
    fontStyle: fontName.style,
    fontSize: node.fontSize as number,
    lineHeight: normalizeLineHeight(lineHeight),
  };
};

const typographyEqual = (a: TypographyValue, b: TypographyValue) => {
  const lhEqual =
    (a.lineHeight?.unit ?? "AUTO") === (b.lineHeight?.unit ?? "AUTO") &&
    (a.lineHeight?.value ?? 0) === (b.lineHeight?.value ?? 0);

  return (
    a.fontFamily === b.fontFamily &&
    a.fontStyle === b.fontStyle &&
    a.fontSize === b.fontSize &&
    lhEqual
  );
};

const getDefaultModeIdForVariable = async (variable: Variable) => {
  const collection = await figma.variables.getVariableCollectionByIdAsync(
    variable.variableCollectionId
  );
  return collection?.defaultModeId ?? collection?.modes?.[0]?.modeId;
};

export const findMatchingTypographyVariable = async (
  node: SceneNode,
  _preferredModeName: ModePreference
) => {
  if (!isTextNode(node)) return null;

  const nodeTypos = getNodeTypography(node);
  if (!nodeTypos) return null;

  // Fallback to text styles since typography variables are not supported in this environment.
  const styles = await figma.getLocalTextStylesAsync();
  for (const style of styles) {
    const styleValue: TypographyValue = {
      fontFamily: style.fontName.family,
      fontStyle: style.fontName.style,
      fontSize: style.fontSize,
      lineHeight: normalizeLineHeight(style.lineHeight as LineHeight | undefined),
    };
    if (typographyEqual(nodeTypos, styleValue)) {
      return { variable: style, value: styleValue, isStyle: true };
    }
  }

  return null;
};

export const findNumericVariableMatch = async (
  kind: "fontSize" | "lineHeight" | "letterSpacing",
  value: number
) => {
  const vars = await figma.variables.getLocalVariablesAsync("FLOAT");
  for (const variable of vars) {
    const modeId = await getDefaultModeIdForVariable(variable);
    if (!modeId) continue;
    const v = variable.valuesByMode[modeId];
    if (typeof v === "number" && Math.abs(v - value) < 1e-5) {
      return variable;
    }
  }
  return null;
};

export const applyTypographyVariable = async (nodeId: string, variableId: string) => {
  const node = (await figma.getNodeByIdAsync(nodeId)) as SceneNode | null;
  if (!node || node.type !== "TEXT") return false;

  node.textStyleId = variableId;
  return true;
};
