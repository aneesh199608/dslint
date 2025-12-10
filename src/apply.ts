import { sendStatus } from "./messages";
import { findNearestColorVariable, resolveColorForMode } from "./variables";
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

  const paintOpacity = typeof first.opacity === "number" ? first.opacity : 1;
  const nearestVariable = await findNearestColorVariable(
    first.color,
    paintOpacity,
    preferredModeName
  );

  if (!nearestVariable) {
    sendStatus({
      title: "No tokens found",
      message: "Could not find a suitable color token to apply.",
      state: "error",
    });
    return;
  }

  // If already bound to this variable, bail early.
  const alreadyBound =
    (typeof first.boundVariables?.color === "string"
      ? first.boundVariables?.color
      : first.boundVariables?.color?.id) === nearestVariable.id;

  if (alreadyBound) {
    sendStatus({
      title: "Already applied",
      message: "This color is already bound to that token.",
      state: "info",
    });
    return;
  }

  const resolved = await resolveColorForMode(nearestVariable, preferredModeName);
  const variableAlpha = resolved?.a ?? 1;

  // If the token carries alpha, use it directly (not multiplied by the existing paint opacity).
  // Otherwise, preserve the existing paint opacity.
  const nextOpacity = variableAlpha < 1 ? variableAlpha : paintOpacity;

  const nextColor =
    resolved != null
      ? { r: resolved.r, g: resolved.g, b: resolved.b }
      : first.color;

  const updatedPaint: SolidPaint = {
    ...first,
    color: nextColor,
    opacity: nextOpacity,
    boundVariables: {
      ...(first.boundVariables ?? {}),
      color: { id: nearestVariable.id, type: "VARIABLE_ALIAS" },
    },
  };

  if (target === "fill") {
    // Clear conflicting style id if present.
    const setFillStyleIdAsync = (node as any).setFillStyleIdAsync;
    if (typeof setFillStyleIdAsync === "function") {
      try {
        await setFillStyleIdAsync.call(node, "");
      } catch {
        // Ignore failures; continue with applying the paint + binding.
      }
    }
    (node as GeometryMixin).fills = [updatedPaint];
    // Also bind explicitly so node.boundVariables reflects the change immediately.
    try {
      (node as any).setBoundVariable?.("fills/0/color", {
        id: nearestVariable.id,
        type: "VARIABLE_ALIAS",
      });
    } catch {
      // Swallow; the paint-level boundVariables above still applies the token.
    }
  } else {
    const setStrokeStyleIdAsync = (node as any).setStrokeStyleIdAsync;
    if (typeof setStrokeStyleIdAsync === "function") {
      try {
        await setStrokeStyleIdAsync.call(node, "");
      } catch {
        // Ignore failures; continue with applying the paint + binding.
      }
    }
    (node as GeometryMixin).strokes = [updatedPaint];
    try {
      (node as any).setBoundVariable?.("strokes/0/color", {
        id: nearestVariable.id,
        type: "VARIABLE_ALIAS",
      });
    } catch {
      // Ignore; paint-level binding remains.
    }
  }

  sendStatus({
    title: "Token applied",
    message: `Applied ${target} token: ${nearestVariable.name}`,
    state: "applied",
  });

  // Refresh UI so the row updates to "Using variable" after apply.
  await scanSelection(preferredModeName);
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

  const allZero = pl === 0 && pr === 0 && pt === 0 && pb === 0;
  if (allZero) {
    sendStatus({
      title: "No padding tokens applied",
      message: "Padding is 0 on all sides; nothing to tokenize.",
      state: "info",
    });
    return;
  }

  const isUniform = pl === pr && pl === pt && pl === pb;
  if (isUniform) {
    if (pl === 0) {
      sendStatus({
        title: "No padding tokens applied",
        message: "Padding is 0; nothing to tokenize.",
        state: "info",
      });
      return;
    }
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
    const hVar = pl > 0 ? await findSpacingVariable(pl) : null;
    const vVar = pt > 0 ? await findSpacingVariable(pt) : null;
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
  const topVar = pt > 0 ? await findSpacingVariable(pt) : null;
  const rightVar = pr > 0 ? await findSpacingVariable(pr) : null;
  const bottomVar = pb > 0 ? await findSpacingVariable(pb) : null;
  const leftVar = pl > 0 ? await findSpacingVariable(pl) : null;

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

export const applyGapTokenToNode = async (nodeId: string, preferredModeName: ModePreference) => {
  const node = (await figma.getNodeByIdAsync(nodeId)) as SceneNode | null;
  if (!node || !("itemSpacing" in node) || !("layoutMode" in node)) {
    sendStatus({
      title: "Unsupported selection",
      message: "Gap apply works on auto layout frames/components/instances.",
      state: "error",
    });
    return;
  }

  const layoutMode = (node as any).layoutMode;
  const isAutoLayout = layoutMode === "HORIZONTAL" || layoutMode === "VERTICAL";
  if (!isAutoLayout) {
    sendStatus({
      title: "Gap not applied",
      message: "Gap applies only to auto layout nodes.",
      state: "info",
    });
    return;
  }

  const spacing = (node as LayoutMixin).itemSpacing;
  const primaryAxisAlign = (node as any).primaryAxisAlignItems;
  const usesAutoGap =
    spacing === "AUTO" ||
    spacing === "Auto" ||
    primaryAxisAlign === "SPACE_BETWEEN" ||
    primaryAxisAlign === "AUTO";

  if (usesAutoGap) {
    sendStatus({
      title: "No gap token applied",
      message: "Gap uses Auto spacing; leaving unchanged.",
      state: "info",
    });
    return;
  }

  if (typeof spacing !== "number" || spacing <= 0) {
    sendStatus({
      title: "No gap token applied",
      message: "Gap is 0; nothing to tokenize.",
      state: "info",
    });
    return;
  }

  const match = await findSpacingVariable(spacing);
  if (!match) {
    sendStatus({
      title: "No gap token found",
      message: "No matching spacing token for this gap value.",
      state: "info",
    });
    return;
  }

  (node as any).setBoundVariable("itemSpacing", { id: match.id, type: "VARIABLE_ALIAS" });

  sendStatus({
    title: "Gap token applied",
    message: `Applied gap token: ${match.name}`,
    state: "applied",
  });
};

export const applyStrokeWeightTokenToNode = async (
  nodeId: string,
  preferredModeName: ModePreference
) => {
  const node = (await figma.getNodeByIdAsync(nodeId)) as SceneNode | null;
  if (!node || !("strokeWeight" in node) || !("strokes" in node)) {
    sendStatus({
      title: "Unsupported selection",
      message: "Stroke weight apply works on nodes with strokes.",
      state: "error",
    });
    return;
  }

  const strokes = (node as GeometryMixin).strokes;
  if (!strokes || strokes === figma.mixed || strokes.length === 0) {
    sendStatus({
      title: "No stroke weight applied",
      message: "No strokes detected to tokenize.",
      state: "info",
    });
    return;
  }

  const first = strokes[0];
  if (first.type !== "SOLID") {
    sendStatus({
      title: "Unsupported stroke type",
      message: "Only solid strokes are supported for stroke weight tokenization.",
      state: "info",
    });
    return;
  }

  const weight = (node as any).strokeWeight;
  if (typeof weight !== "number" || weight <= 0) {
    sendStatus({
      title: "No stroke weight applied",
      message: "Stroke weight is 0 or unset; nothing to tokenize.",
      state: "info",
    });
    return;
  }

  const match = await findSpacingVariable(weight);
  if (!match) {
    sendStatus({
      title: "No stroke weight token found",
      message: "No matching spacing token for this stroke weight.",
      state: "info",
    });
    return;
  }

  // Clear stroke style id if present to avoid conflicts.
  const setStrokeStyleIdAsync = (node as any).setStrokeStyleIdAsync;
  if (typeof setStrokeStyleIdAsync === "function") {
    try {
      await setStrokeStyleIdAsync.call(node, "");
    } catch {
      // ignore
    }
  }

  // Attempt to bind at node-level and per-stroke path for robustness.
  try {
    (node as any).setBoundVariable?.("strokeWeight", { id: match.id, type: "VARIABLE_ALIAS" });
  } catch {
    // ignore binding errors
  }
  // If the node supports per-side stroke weights, bind those too to mimic Figma's UI controls.
  const sideProps = ["strokeTopWeight", "strokeRightWeight", "strokeBottomWeight", "strokeLeftWeight"];
  for (const prop of sideProps) {
    if (prop in (node as any)) {
      try {
        (node as any).setBoundVariable?.(prop, { id: match.id, type: "VARIABLE_ALIAS" });
      } catch {
        // ignore per-side binding errors
      }
    }
  }
  try {
    (node as any).setBoundVariable?.("strokes/0/weight", { id: match.id, type: "VARIABLE_ALIAS" });
  } catch {
    // ignore binding errors; node-level binding may still work
  }
  try {
    const current = (node as any).boundVariables ?? {};
    const existingStrokeEntry = current.strokes?.[0] ?? {};
    (node as any).boundVariables = {
      ...current,
      strokeWeight: { id: match.id, type: "VARIABLE_ALIAS" },
      strokes: {
        ...(current.strokes ?? {}),
        0: { ...existingStrokeEntry, weight: { id: match.id, type: "VARIABLE_ALIAS" } },
      },
    };
  } catch {
    // ignore direct assignment failures
  }

  // Ensure strokes array persists the weight after potential style clear.
  try {
    const nextStrokes = Array.isArray(strokes) ? [...strokes] : [];
    if (nextStrokes[0] && typeof nextStrokes[0] === "object") {
      // Bind weight directly on the stroke entry so scans can see the alias.
      const existingStrokeBound = (nextStrokes[0] as any).boundVariables ?? {};
      nextStrokes[0] = {
        ...nextStrokes[0],
        weight: { id: match.id, type: "VARIABLE_ALIAS" },
        boundVariables: {
          ...existingStrokeBound,
          weight: { id: match.id, type: "VARIABLE_ALIAS" },
        },
      };
      (node as GeometryMixin).strokes = nextStrokes;
      // Also keep the numeric strokeWeight in sync for display/rendering.
      try {
        (node as any).strokeWeight = weight;
      } catch {
        // ignore
      }
      // Sync per-side numeric values if present so the UI reflects the same weight everywhere.
      const sideProps = ["strokeTopWeight", "strokeRightWeight", "strokeBottomWeight", "strokeLeftWeight"];
      for (const prop of sideProps) {
        if (prop in (node as any)) {
          try {
            (node as any)[prop] = weight;
          } catch {
            // ignore per-side numeric sync
          }
        }
      }
    }
  } catch {
    // ignore paint assignment issues
  }

  sendStatus({
    title: "Stroke weight token applied",
    message: `Applied stroke weight token: ${match.name}`,
    state: "applied",
  });
};

export const applyCornerRadiusTokenToNode = async (
  nodeId: string,
  preferredModeName: ModePreference
) => {
  const node = (await figma.getNodeByIdAsync(nodeId)) as SceneNode | null;
  if (!node || !("cornerRadius" in node)) {
    sendStatus({
      title: "Unsupported selection",
      message: "Corner radius apply works on nodes with corner radii.",
      state: "error",
    });
    return;
  }

  const radiusValue = (node as any).cornerRadius;

  const bindCorner = async (prop: string, variableId: string) => {
    try {
      (node as any).setBoundVariable?.(prop, { id: variableId, type: "VARIABLE_ALIAS" });
    } catch {
      // swallow binding errors
    }
  };

  const applyVariable = async (variable: Variable) => {
    if (radiusValue !== figma.mixed) {
      // Uniform radius: bind to cornerRadius and to all corners for consistency.
      bindCorner("cornerRadius", variable.id);
      bindCorner("topLeftRadius", variable.id);
      bindCorner("topRightRadius", variable.id);
      bindCorner("bottomRightRadius", variable.id);
      bindCorner("bottomLeftRadius", variable.id);
    } else {
      // Mixed radii: bind per-corner if present.
      const corners = ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"] as const;
      for (const c of corners) {
        const val = (node as any)[c];
        if (typeof val === "number" && val > 0) {
          bindCorner(c, variable.id);
        }
      }
    }
    sendStatus({
      title: "Corner radius token applied",
      message: `Applied corner radius token: ${variable.name}`,
      state: "applied",
    });
  };

  if (typeof radiusValue === "number") {
    if (radiusValue <= 0) {
      sendStatus({
        title: "No corner radius tokens applied",
        message: "Corner radius is 0; nothing to tokenize.",
        state: "info",
      });
      return;
    }

    const match = await findSpacingVariable(radiusValue);
    if (match) {
      await applyVariable(match, "exact");
      return;
    }

    sendStatus({
      title: "No corner radius token found",
      message: "No matching spacing token for this corner radius value.",
      state: "info",
    });
    return;
  }

  if (radiusValue === figma.mixed) {
    const corners = [
      { prop: "topLeftRadius", value: (node as any).topLeftRadius },
      { prop: "topRightRadius", value: (node as any).topRightRadius },
      { prop: "bottomRightRadius", value: (node as any).bottomRightRadius },
      { prop: "bottomLeftRadius", value: (node as any).bottomLeftRadius },
    ];

    const applicable = corners.filter((c) => typeof c.value === "number" && c.value > 0);
    if (!applicable.length) {
      sendStatus({
        title: "No corner radius tokens applied",
        message: "Corner radius values are 0; nothing to tokenize.",
        state: "info",
      });
      return;
    }

    let appliedAny = false;
    for (const c of applicable) {
      const match = await findSpacingVariable(c.value as number);
      if (match) {
        await bindCorner(c.prop, match.id);
        appliedAny = true;
      }
    }

    if (appliedAny) {
      sendStatus({
        title: "Corner radius token applied",
        message: "Applied corner radius tokens to available corners.",
        state: "applied",
      });
    } else {
      sendStatus({
        title: "No corner radius token found",
        message: "No matching spacing tokens for corner radius values.",
        state: "info",
      });
    }
    return;
  }
};

export const applyAllMissing = async (
  preferredModeName: ModePreference,
  opts?: { fills?: boolean; strokes?: boolean; spacing?: boolean }
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
    if (opts?.spacing !== false && item.padding?.state === "missing") {
      await applyPaddingTokenToNode(item.id, preferredModeName);
    }
    if (opts?.spacing !== false && item.gap?.state === "missing") {
      await applyGapTokenToNode(item.id, preferredModeName);
    }
    if (opts?.spacing !== false && item.strokeWeight?.state === "missing") {
      await applyStrokeWeightTokenToNode(item.id, preferredModeName);
    }
    if (opts?.spacing !== false && item.cornerRadius?.state === "missing") {
      await applyCornerRadiusTokenToNode(item.id, preferredModeName);
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
