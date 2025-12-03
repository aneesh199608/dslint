import { sendStatus } from "./messages";
import { findNearestColorVariable } from "./variables";
import { scanSelection } from "./scanner";
import { findMatchingTypographyVariable } from "./typography";
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

export const applyAllMissing = async (
  preferredModeName: ModePreference,
  opts?: { fills?: boolean; strokes?: boolean; typography?: boolean }
) => {
  const results = await scanSelection(preferredModeName);
  if (!results.length) return;

  for (const item of results) {
    if (opts?.fills !== false && item.fill?.state === "missing") {
      await applyNearestTokenToNode(item.id, preferredModeName, "fill");
    }
    if (opts?.strokes !== false && item.stroke?.state === "missing") {
      await applyNearestTokenToNode(item.id, preferredModeName, "stroke");
    }
    if (opts?.typography !== false && item.typography?.state === "missing") {
      await applyTypographyToNode(item.id, preferredModeName);
    }
  }

  await scanSelection(preferredModeName);
};

export const applyTypographyToNode = async (nodeId: string, preferredModeName: ModePreference) => {
  try {
    const node = (await figma.getNodeByIdAsync(nodeId)) as SceneNode | null;
    if (!node || node.type !== "TEXT") {
      sendStatus({
        title: "Apply failed",
        message: "Typography apply only works on text nodes.",
        state: "error",
      });
      return;
    }

    const match = await findMatchingTypographyVariable(node, preferredModeName);
    if (!match) {
      sendStatus({
        title: "No matching typography token",
        message: "Could not find a typography token that matches this text.",
        state: "info",
      });
      return;
    }

    // Ensure font is loaded before applying style.
    if (node.fontName !== figma.mixed) {
      await figma.loadFontAsync(node.fontName as FontName);
    }

    node.textStyleId = match.variable.id;

    sendStatus({
      title: "Typography applied",
      message: `Applied typography token: ${match.variable.name}`,
      state: "applied",
    });
  } catch (error) {
    sendStatus({
      title: "Apply failed",
      message: "Could not apply typography token.",
      state: "error",
    });
  }
};
