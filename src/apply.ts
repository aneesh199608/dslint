import { sendStatus } from "./messages";
import { findNearestColorVariable } from "./variables";
import { evalNodeFill } from "./scanner";
import { gatherNodesWithFills } from "./selection";
import type { ModePreference } from "./types";

export const applyNearestTokenToNode = async (
  nodeId: string,
  preferredModeName: ModePreference
) => {
  const node = (await figma.getNodeByIdAsync(nodeId)) as SceneNode | null;
  if (!node) {
    sendStatus({
      title: "Apply failed",
      message: "Node not found.",
      state: "error",
    });
    return;
  }

  if (!("fills" in node)) {
    sendStatus({
      title: "Unsupported selection",
      message: "Select a node that supports fills.",
      state: "error",
    });
    return;
  }

  const fills = node.fills;

  if (fills === figma.mixed || fills.length === 0) {
    sendStatus({
      title: "No fill detected",
      message: "Add a solid fill to apply a color token.",
      state: "error",
    });
    return;
  }

  const firstFill = fills[0];

  if (firstFill.type !== "SOLID") {
    sendStatus({
      title: "Unsupported fill type",
      message: "Only solid fills are supported for applying a token.",
      state: "error",
    });
    return;
  }

  const nearestVariable = await findNearestColorVariable(firstFill.color, preferredModeName);

  if (!nearestVariable) {
    sendStatus({
      title: "No tokens found",
      message: "Could not find a suitable color token to apply.",
      state: "error",
    });
    return;
  }

  const updatedFill: SolidPaint = {
    ...firstFill,
    boundVariables: {
      ...(firstFill.boundVariables ?? {}),
      color: { id: nearestVariable.id, type: "VARIABLE_ALIAS" },
    },
  };

  node.fills = [updatedFill];
};

export const applyAllMissing = async (preferredModeName: ModePreference) => {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    sendStatus({
      title: "Select a layer or frame to inspect.",
      message: "Choose a node to scan and apply tokens.",
      state: "info",
    });
    return;
  }

  const nodes = gatherNodesWithFills(selection);
  for (const node of nodes) {
    const res = await evalNodeFill(node, preferredModeName);
    if (res?.state === "missing") {
      await applyNearestTokenToNode(node.id, preferredModeName);
    }
  }
};
