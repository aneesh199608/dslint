import { rgbToHex } from "./colors";
import { sendStatus } from "./messages";
import { gatherNodesWithFills } from "./selection";
import { setOriginalSelection } from "./highlight";
import type { ModePreference, NodeScanResult } from "./types";

export const evalNodeFill = async (
  node: SceneNode,
  preferredModeName: ModePreference
): Promise<NodeScanResult | null> => {
  if (!("fills" in node)) return null;

  const fills = node.fills;

  if (fills === figma.mixed || fills.length === 0) {
    return {
      id: node.id,
      name: node.name,
      message: "No fill detected",
      state: "info",
    };
  }

  const firstFill = fills[0];

  if (firstFill.type !== "SOLID") {
    return {
      id: node.id,
      name: node.name,
      message: "Unsupported fill type (only SOLID supported)",
      state: "error",
    };
  }

  const bound = firstFill.boundVariables?.color;
  const boundId = typeof bound === "string" ? bound : bound?.id;

  if (boundId) {
    const variable = await figma.variables.getVariableByIdAsync(boundId);
    const variableName = variable?.name ?? "Color variable";

    return {
      id: node.id,
      name: node.name,
      message: `Using variable: ${variableName}`,
      state: "found",
      variableName,
    };
  }

  const hex = rgbToHex(firstFill.color);

  return {
    id: node.id,
    name: node.name,
    message: `Fill color: ${hex} is not using a variable.`,
    state: "missing",
    hex,
  };
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

  const nodes = gatherNodesWithFills(selection);
  const results: NodeScanResult[] = [];

  for (const node of nodes) {
    const res = await evalNodeFill(node, preferredModeName);
    if (res) results.push(res);
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
