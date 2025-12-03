import { sendStatus } from "./messages";
import { findNearestColorVariable } from "./variables";
import { scanSelection } from "./scanner";
import type { ModePreference } from "./types";
import type { SolidPaint } from "@figma/plugin-typings";

export const applyNearestTokenToNode = async (
  nodeId: string,
  preferredModeName: ModePreference,
  target: "fill" | "stroke" = "fill"
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

  const paints = target === "fill" ? (node as GeometryMixin).fills : (node as GeometryMixin).strokes;

  if (!paints) {
    sendStatus({
      title: "Unsupported selection",
      message: `Select a node that supports ${target}s.`,
      state: "error",
    });
    return;
  }

  if (paints === figma.mixed || paints.length === 0) {
    sendStatus({
      title: `No ${target} detected`,
      message: `Add a solid ${target} to apply a color token.`,
      state: "error",
    });
    return;
  }

  const first = paints[0];

  if (first.type !== "SOLID") {
    sendStatus({
      title: "Unsupported paint type",
      message: "Only solid paints are supported for applying a token.",
      state: "error",
    });
    return;
  }

  const nearestVariable = await findNearestColorVariable(first.color, preferredModeName);

  if (!nearestVariable) {
    sendStatus({
      title: "No tokens found",
      message: "Could not find a suitable color token to apply.",
      state: "error",
    });
    return;
  }

  const updatedPaint: SolidPaint = {
    ...first,
    boundVariables: {
      ...(first.boundVariables ?? {}),
      color: { id: nearestVariable.id, type: "VARIABLE_ALIAS" },
    },
  };

  if (target === "fill") {
    (node as GeometryMixin).fills = [updatedPaint];
  } else {
    (node as GeometryMixin).strokes = [updatedPaint];
  }
};

export const applyAllMissing = async (preferredModeName: ModePreference) => {
  const results = await scanSelection(preferredModeName);
  if (!results.length) return;

  for (const item of results) {
    if (item.fill?.state === "missing") {
      await applyNearestTokenToNode(item.id, preferredModeName, "fill");
    }
    if (item.stroke?.state === "missing") {
      await applyNearestTokenToNode(item.id, preferredModeName, "stroke");
    }
  }

  await scanSelection(preferredModeName);
};
