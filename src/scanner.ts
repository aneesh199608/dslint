import { rgbToHex } from "./colors";
import { sendStatus } from "./messages";
import { gatherNodesWithPaints } from "./selection";
import { findMatchingTypographyVariable } from "./typography";
import { setOriginalSelection } from "./highlight";
import type {
  ModePreference,
  NodeScanResult,
  PaintInfo,
  StatusState,
  TypographyInfo,
} from "./types";

const evalPaint = async (
  node: SceneNode,
  kind: "fill" | "stroke",
  preferredModeName: ModePreference
): Promise<PaintInfo | null> => {
  const paints = kind === "fill" ? (node as GeometryMixin).fills : (node as GeometryMixin).strokes;
  if (!paints) return null;
  if (paints === figma.mixed || paints.length === 0) {
    return null;
  }

  const first = paints[0];

  if (first.type !== "SOLID") {
    return {
      kind,
      message: `Unsupported ${kind} type (only SOLID supported)`,
      state: "error",
    };
  }

  const bound = first.boundVariables?.color;
  const boundId = typeof bound === "string" ? bound : bound?.id;

  if (boundId) {
    const variable = await figma.variables.getVariableByIdAsync(boundId);
    const variableName = variable?.name ?? "Color variable";

    return {
      kind,
      message: `Using variable: ${variableName}`,
      state: "found",
      variableName,
    };
  }

  const hex = rgbToHex(first.color);

  return {
    kind,
    message: `${kind === "fill" ? "Fill" : "Stroke"} color: ${hex} is not using a variable.`,
    state: "missing",
    hex,
  };
};

const computeOverallState = (fill?: PaintInfo | null, stroke?: PaintInfo | null): StatusState => {
  const parts = [fill, stroke].filter(Boolean) as PaintInfo[];
  if (parts.some((p) => p.state === "missing")) return "missing";
  if (parts.some((p) => p.state === "error")) return "error";
  if (parts.some((p) => p.state === "found" || p.state === "applied")) return "found";
  return "info";
};

export const scanSelection = async (preferredModeName: ModePreference): Promise<NodeScanResult[]> => {
  const selection = figma.currentPage.selection;
  setOriginalSelection(selection);

  if (selection.length === 0) {
    sendStatus({
      title: "Select a layer or frame to inspect.",
      message: "Choose a single node or frame to scan for color tokens.",
      state: "info",
    });
    figma.ui.postMessage({ type: "scan-results", payload: { items: [], mode: preferredModeName } });
    return [];
  }

  const nodes = gatherNodesWithPaints(selection);
  const results: NodeScanResult[] = [];

  for (const node of nodes) {
    const fill = await evalPaint(node, "fill", preferredModeName);
    const stroke = await evalPaint(node, "stroke", preferredModeName);
    let typography: TypographyInfo | undefined;

    if (node.type === "TEXT") {
      const match = await findMatchingTypographyVariable(node, preferredModeName);
      const boundId = node.textStyleId;

      if (boundId) {
        const style = figma.getStyleById(boundId);
        typography = {
          message: `Using typography style: ${style?.name ?? "Text style"}`,
          state: "info",
          variableName: style?.name,
        };
      } else if (match) {
        typography = {
          message: `Typography: matches ${match.variable.name} (coming soon)`,
          state: "info",
          variableName: match.variable.name,
        };
      } else {
        typography = {
          message: "Typography: no matching token (coming soon)",
          state: "info",
        };
      }
    }

    if (!fill && !stroke && !typography) continue;

    const state = computeOverallState(fill, stroke);

    results.push({
      id: node.id,
      name: node.name,
      state,
      fill: fill || undefined,
      stroke: stroke || undefined,
      typography,
    });
  }

  const found = results.filter((r) => r.state === "found").length;
  const missing = results.filter((r) => r.state === "missing").length;
  const errors = results.filter((r) => r.state === "error").length;

  const title = "Scan complete";
  const message = `${found} with tokens, ${missing} missing, ${errors} unsupported`;

  sendStatus({ title, message, state: "info" });
  figma.ui.postMessage({
    type: "scan-results",
    payload: {
      items: results,
      mode: preferredModeName,
    },
  });

  return results;
};
