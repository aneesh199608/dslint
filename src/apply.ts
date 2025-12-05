import { sendStatus } from "./messages";
import { findNearestColorVariable } from "./variables";
import { scanSelection } from "./scanner";
import { findMatchingTypographyVariable, findNumericVariableMatch } from "./typography";
import { findSpacingVariable } from "./spacing";
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

export const applyPaddingTokenToNode = async (
  nodeId: string,
  preferredModeName: ModePreference
) => {
  const node = (await figma.getNodeByIdAsync(nodeId)) as SceneNode | null;
  if (!node || !("paddingLeft" in node)) {
    sendStatus({
      title: "Unsupported selection",
      message: "Padding apply works on frames/components/instances with padding.",
      state: "error",
    });
    return;
  }

  const pl = (node as LayoutMixin).paddingLeft;
  const pr = (node as LayoutMixin).paddingRight;
  const pt = (node as LayoutMixin).paddingTop;
  const pb = (node as LayoutMixin).paddingBottom;

  const isUniform = pl === pr && pl === pt && pl === pb;
  if (isUniform) {
    const match = await findSpacingVariable(pl);
    if (!match) {
      sendStatus({
        title: "No padding token found",
        message: "No matching spacing token for this padding value.",
      state: "info",
    });
    return;
  }

  node.setBoundVariable("paddingLeft", { id: match.id, type: "VARIABLE_ALIAS" });
  node.setBoundVariable("paddingRight", { id: match.id, type: "VARIABLE_ALIAS" });
  node.setBoundVariable("paddingTop", { id: match.id, type: "VARIABLE_ALIAS" });
  node.setBoundVariable("paddingBottom", { id: match.id, type: "VARIABLE_ALIAS" });
    sendStatus({
      title: "Padding token applied",
      message: `Applied padding token: ${match.name}`,
      state: "applied",
    });
    return;
  }

  const isHorizontal = pl === pr && pt === pb;
  if (isHorizontal) {
    const hVar = await findSpacingVariable(pl);
    const vVar = await findSpacingVariable(pt);
    if (!hVar && !vVar) {
      sendStatus({
        title: "No padding tokens found",
        message: "No matching spacing tokens for padding values.",
        state: "info",
      });
      return;
    }

    if (hVar) {
      node.setBoundVariable("paddingLeft", { id: hVar.id, type: "VARIABLE_ALIAS" });
      node.setBoundVariable("paddingRight", { id: hVar.id, type: "VARIABLE_ALIAS" });
    }
    if (vVar) {
      node.setBoundVariable("paddingTop", { id: vVar.id, type: "VARIABLE_ALIAS" });
      node.setBoundVariable("paddingBottom", { id: vVar.id, type: "VARIABLE_ALIAS" });
    }
    sendStatus({
      title: "Padding tokens applied",
      message: "Applied padding tokens for horizontal/vertical.",
      state: "applied",
    });
    return;
  }

  // Per-side binding if possible.
  const topVar = await findSpacingVariable(pt);
  const rightVar = await findSpacingVariable(pr);
  const bottomVar = await findSpacingVariable(pb);
  const leftVar = await findSpacingVariable(pl);

  if (!topVar && !rightVar && !bottomVar && !leftVar) {
    sendStatus({
      title: "No padding tokens found",
      message: "No matching spacing tokens for padding values.",
      state: "info",
    });
    return;
  }

  if (topVar) node.setBoundVariable("paddingTop", { id: topVar.id, type: "VARIABLE_ALIAS" });
  if (rightVar) node.setBoundVariable("paddingRight", { id: rightVar.id, type: "VARIABLE_ALIAS" });
  if (bottomVar) node.setBoundVariable("paddingBottom", { id: bottomVar.id, type: "VARIABLE_ALIAS" });
  if (leftVar) node.setBoundVariable("paddingLeft", { id: leftVar.id, type: "VARIABLE_ALIAS" });

  sendStatus({
    title: "Padding tokens applied",
    message: "Applied available padding tokens.",
    state: "applied",
  });
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

    sendStatus({
      title: "Typography coming soon",
      message: "Apply for typography tokens is not available yet.",
      state: "info",
    });
  } catch (error) {
    sendStatus({
      title: "Apply failed",
      message: "Could not apply typography token.",
      state: "error",
    });
  }
};
