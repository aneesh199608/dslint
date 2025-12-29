import type { LibraryScope, ModePreference } from "./types";
import { getVariablesForScope, LOCAL_LIBRARY_OPTION } from "./libraries";

type TypographyValue = {
  fontFamily?: string;
  fontSize?: number;
  fontStyle?: string;
  lineHeight?: { unit: "PIXELS" | "PERCENT" | "AUTO"; value?: number };
  letterSpacing?: { unit: "PIXELS" | "PERCENT"; value: number };
};

export const TYPOGRAPHY_MATCH_THRESHOLDS = {
  fontSizePx: 1,
  lineHeightPx: 2,
  lineHeightPercent: 1,
  letterSpacingPx: 0.2,
  letterSpacingPercent: 0.5,
};

const isTextNode = (node: SceneNode): node is TextNode => node.type === "TEXT";

const nearlyEqual = (a?: number, b?: number) => Math.abs((a ?? 0) - (b ?? 0)) < 0.0001;

const normalizeLineHeight = (lineHeight?: LineHeight): TypographyValue["lineHeight"] => {
  if (!lineHeight) return undefined;
  if (lineHeight.unit === "AUTO") {
    return { unit: "AUTO" };
  }
  return { unit: lineHeight.unit, value: lineHeight.value };
};

const normalizeLetterSpacing = (
  letterSpacing?: LetterSpacing
): TypographyValue["letterSpacing"] => {
  if (!letterSpacing) {
    return { unit: "PERCENT", value: 0 };
  }
  return {
    unit: letterSpacing.unit,
    value: letterSpacing.value ?? 0,
  };
};

const typographyEqual = (a: TypographyValue, b: TypographyValue) => {
  const lhA = a.lineHeight ?? { unit: "AUTO" as const };
  const lhB = b.lineHeight ?? { unit: "AUTO" as const };
  const lsA = a.letterSpacing ?? { unit: "PERCENT" as const, value: 0 };
  const lsB = b.letterSpacing ?? { unit: "PERCENT" as const, value: 0 };
  const lhEqual = lhA.unit === lhB.unit && nearlyEqual(lhA.value, lhB.value);
  const lsEqual = lsA.unit === lsB.unit && nearlyEqual(lsA.value, lsB.value);

  return (
    a.fontFamily === b.fontFamily &&
    a.fontStyle === b.fontStyle &&
    nearlyEqual(a.fontSize, b.fontSize) &&
    lhEqual &&
    lsEqual
  );
};

const getLineHeightDiff = (a?: TypographyValue["lineHeight"], b?: TypographyValue["lineHeight"]) => {
  const lhA = a ?? { unit: "AUTO" as const };
  const lhB = b ?? { unit: "AUTO" as const };
  if (lhA.unit !== lhB.unit) return null;
  if (lhA.unit === "AUTO") {
    return { diff: 0, threshold: TYPOGRAPHY_MATCH_THRESHOLDS.lineHeightPx, unit: lhA.unit };
  }
  const diff = Math.abs((lhA.value ?? 0) - (lhB.value ?? 0));
  const threshold =
    lhA.unit === "PERCENT"
      ? TYPOGRAPHY_MATCH_THRESHOLDS.lineHeightPercent
      : TYPOGRAPHY_MATCH_THRESHOLDS.lineHeightPx;
  return { diff, threshold, unit: lhA.unit };
};

const getLetterSpacingDiff = (
  a?: TypographyValue["letterSpacing"],
  b?: TypographyValue["letterSpacing"]
) => {
  const lsA = a ?? { unit: "PERCENT" as const, value: 0 };
  const lsB = b ?? { unit: "PERCENT" as const, value: 0 };
  if (lsA.unit !== lsB.unit) return null;
  const diff = Math.abs((lsA.value ?? 0) - (lsB.value ?? 0));
  const threshold =
    lsA.unit === "PERCENT"
      ? TYPOGRAPHY_MATCH_THRESHOLDS.letterSpacingPercent
      : TYPOGRAPHY_MATCH_THRESHOLDS.letterSpacingPx;
  return { diff, threshold, unit: lsA.unit };
};

const getTypographyForRange = (node: TextNode, start: number, end: number) => {
  try {
    const fontName = node.getRangeFontName(start, end);
    const fontSize = node.getRangeFontSize(start, end);
    const lineHeight = node.getRangeLineHeight(start, end);
    const letterSpacing = node.getRangeLetterSpacing(start, end);

    if (
      fontName === figma.mixed ||
      fontSize === figma.mixed ||
      lineHeight === figma.mixed ||
      letterSpacing === figma.mixed
    ) {
      return null;
    }

    return {
      fontFamily: (fontName as FontName).family,
      fontStyle: (fontName as FontName).style,
      fontSize: fontSize as number,
      lineHeight: normalizeLineHeight(lineHeight as LineHeight | undefined),
      letterSpacing: normalizeLetterSpacing(letterSpacing as LetterSpacing | undefined),
    } as TypographyValue;
  } catch (err) {
    return null;
  }
};

const getNodeTypography = (node: TextNode): { value?: TypographyValue; reason?: string } => {
  if (node.hasMissingFont) return { reason: "Missing fonts; typography not checked." };
  const len = node.characters?.length ?? 0;
  if (len === 0) return { reason: "Empty text node; nothing to tokenize." };

  const base: TypographyValue | null =
    node.fontName !== figma.mixed &&
    node.fontSize !== figma.mixed &&
    node.lineHeight !== figma.mixed &&
    node.letterSpacing !== figma.mixed
      ? {
          fontFamily: (node.fontName as FontName).family,
          fontStyle: (node.fontName as FontName).style,
          fontSize: node.fontSize as number,
          lineHeight: normalizeLineHeight(node.lineHeight as LineHeight | undefined),
          letterSpacing: normalizeLetterSpacing(node.letterSpacing as LetterSpacing | undefined),
        }
      : getTypographyForRange(node, 0, 1);

  if (!base) return { reason: "Unsupported typography values (mixed styles)." };

  const isMixed =
    node.fontName === figma.mixed ||
    node.fontSize === figma.mixed ||
    node.lineHeight === figma.mixed ||
    node.letterSpacing === figma.mixed;

  if (isMixed) {
    for (let i = 1; i < len; i++) {
      const rangeValue = getTypographyForRange(node, i, i + 1);
      if (!rangeValue) return { reason: "Mixed typography styles; not tokenized." };
      if (!typographyEqual(base, rangeValue)) {
        return { reason: "Mixed typography styles; not tokenized." };
      }
    }
  }

  return { value: base };
};

const getDefaultModeIdForVariable = async (variable: Variable) => {
  const collection = await figma.variables.getVariableCollectionByIdAsync(
    variable.variableCollectionId
  );
  return collection?.defaultModeId ?? collection?.modes?.[0]?.modeId;
};

export const findMatchingTypographyVariable = async (
  node: SceneNode,
  _preferredModeName: ModePreference,
  _libraryScope: LibraryScope = LOCAL_LIBRARY_OPTION.scope,
  override?: TypographyValue
) => {
  if (!isTextNode(node)) return null;

  const nodeTypos = override ?? getNodeTypography(node).value;
  if (!nodeTypos) return null;

  // Fallback to text styles since typography variables are not supported in this environment.
  const styles = await figma.getLocalTextStylesAsync();
  for (const style of styles) {
    const styleValue: TypographyValue = {
      fontFamily: style.fontName.family,
      fontStyle: style.fontName.style,
      fontSize: style.fontSize,
      lineHeight: normalizeLineHeight(style.lineHeight as LineHeight | undefined),
      letterSpacing: normalizeLetterSpacing(style.letterSpacing as LetterSpacing | undefined),
    };
    if (typographyEqual(nodeTypos, styleValue)) {
      return { variable: style, value: styleValue, isStyle: true };
    }
  }

  return null;
};

export const findClosestTypographyVariable = async (
  node: SceneNode,
  _preferredModeName: ModePreference,
  _libraryScope: LibraryScope = LOCAL_LIBRARY_OPTION.scope,
  override?: TypographyValue
) => {
  if (!isTextNode(node)) return null;

  const nodeTypos = override ?? getNodeTypography(node).value;
  if (!nodeTypos) return null;

  const styles = await figma.getLocalTextStylesAsync();
  let best:
    | {
        variable: TextStyle;
        value: TypographyValue;
        score: number;
        diffs: {
          fontSize: number;
          lineHeight: number;
          letterSpacing: number;
          lineHeightUnit: "PIXELS" | "PERCENT" | "AUTO";
          letterSpacingUnit: "PIXELS" | "PERCENT";
        };
      }
    | null = null;

  for (const style of styles) {
    const styleValue: TypographyValue = {
      fontFamily: style.fontName.family,
      fontStyle: style.fontName.style,
      fontSize: style.fontSize,
      lineHeight: normalizeLineHeight(style.lineHeight as LineHeight | undefined),
      letterSpacing: normalizeLetterSpacing(style.letterSpacing as LetterSpacing | undefined),
    };

    if (styleValue.fontFamily !== nodeTypos.fontFamily || styleValue.fontStyle !== nodeTypos.fontStyle) {
      continue;
    }

    const fontSizeDiff = Math.abs((styleValue.fontSize ?? 0) - (nodeTypos.fontSize ?? 0));
    if (fontSizeDiff > TYPOGRAPHY_MATCH_THRESHOLDS.fontSizePx) continue;

    const lineHeight = getLineHeightDiff(styleValue.lineHeight, nodeTypos.lineHeight);
    if (!lineHeight || lineHeight.diff > lineHeight.threshold) continue;

    const letterSpacing = getLetterSpacingDiff(
      styleValue.letterSpacing,
      nodeTypos.letterSpacing
    );
    if (!letterSpacing || letterSpacing.diff > letterSpacing.threshold) continue;

    const score =
      fontSizeDiff / TYPOGRAPHY_MATCH_THRESHOLDS.fontSizePx +
      lineHeight.diff / lineHeight.threshold +
      letterSpacing.diff / letterSpacing.threshold;

    if (!best || score < best.score) {
      best = {
        variable: style,
        value: styleValue,
        score,
        diffs: {
          fontSize: fontSizeDiff,
          lineHeight: lineHeight.diff,
          letterSpacing: letterSpacing.diff,
          lineHeightUnit: lineHeight.unit,
          letterSpacingUnit: letterSpacing.unit,
        },
      };
    }
  }

  return best;
};

export const findNumericVariableMatch = async (
  kind: "fontSize" | "lineHeight" | "letterSpacing",
  value: number,
  libraryScope: LibraryScope = LOCAL_LIBRARY_OPTION.scope
) => {
  const vars = await getVariablesForScope("FLOAT", libraryScope);
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

  try {
    if (typeof node.setRangeTextStyleId === "function") {
      node.setRangeTextStyleId(0, node.characters.length, variableId);
    }
  } catch {
    // fall back to direct assignment if available
  }

  try {
    (node as any).textStyleId = variableId;
  } catch {
    return false;
  }
  return true;
};

export const getTypography = (node: TextNode) => getNodeTypography(node);

export const loadAllNodeFonts = async (node: TextNode) => {
  try {
    const len = node.characters?.length ?? 0;
    if (len === 0) return;
    const fonts = await node.getRangeAllFontNames(0, len);
    for (const f of fonts) {
      try {
        await figma.loadFontAsync(f);
      } catch {
        // continue to try other fonts
      }
    }
  } catch {
    // ignore errors from getRangeAllFontNames; best effort
  }
};

export const loadFontsForTypography = async (node: TextNode, target?: TypographyValue) => {
  // Load the current font so range edits are allowed.
  try {
    const existing = node.getRangeFontName(0, Math.min(1, node.characters.length || 1));
    if (existing !== figma.mixed) {
      await figma.loadFontAsync(existing as FontName);
    }
  } catch {
    // ignore
  }

  // Load the target font if provided.
  if (target?.fontFamily && target?.fontStyle) {
    try {
      await figma.loadFontAsync({ family: target.fontFamily, style: target.fontStyle });
    } catch {
      // swallow; apply will surface failure if fonts are truly missing
    }
  }
};
