type StatusState = "missing" | "found" | "applied" | "error" | "info";

type StatusPayload = {
  title: string;
  message: string;
  state?: StatusState;
};

figma.showUI(__html__, { width: 360, height: 200 });

const toHex = (value: number): string => {
  const hex = Math.round(value * 255)
    .toString(16)
    .padStart(2, "0");
  return hex.toUpperCase();
};

const rgbToHex = (color: RGB): string =>
  `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;

const sendStatus = (payload: StatusPayload) => {
  figma.ui.postMessage({ type: "status", payload });
};

const rgbDistanceSq = (a: RGB, b: RGB): number => {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
};

const getDefaultModeColor = (variable: Variable): RGB | null => {
  if (variable.resolvedType !== "COLOR") return null;
  const modeId = Object.keys(variable.valuesByMode)[0];
  if (!modeId) return null;
  const value = variable.valuesByMode[modeId];
  if (!value || typeof value !== "object") return null;
  const maybeColor = value as RGB & { a?: number };
  if (typeof maybeColor.r !== "number") return null;
  return { r: maybeColor.r, g: maybeColor.g, b: maybeColor.b };
};

const findNearestColorVariable = async (color: RGB) => {
  const variables = await figma.variables.getLocalVariablesAsync("COLOR");
  let nearest: { variable: Variable; distance: number } | null = null;

  for (const variable of variables) {
    const variableColor = getDefaultModeColor(variable);
    if (!variableColor) continue;
    const distance = rgbDistanceSq(color, variableColor);
    if (!nearest || distance < nearest.distance) {
      nearest = { variable, distance };
    }
  }

  return nearest?.variable ?? null;
};

const applyNearestTokenToSelection = async () => {
  const selection = figma.currentPage.selection;

  if (selection.length !== 1) {
    sendStatus({
      title: "Select a layer or frame to inspect.",
      message: "Choose a single node with a fill to apply a token.",
      state: "error",
    });
    return;
  }

  const node = selection[0];

  if (!("fills" in node)) {
    sendStatus({
      title: "Unsupported selection",
      message: "Select a rectangle or any node that supports fills.",
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

  const nearestVariable = await findNearestColorVariable(firstFill.color);

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

  sendStatus({
    title: "Color token applied",
    message: `Applied token: ${nearestVariable.name}`,
    state: "applied",
  });
};

const inspectSelection = async () => {
  const selection = figma.currentPage.selection;

  if (selection.length !== 1) {
    sendStatus({
      title: "Select a layer or frame to inspect.",
      message: "Choose a single node with a fill to check for color tokens.",
      state: "info",
    });
    return;
  }

  const node = selection[0];

  if (!("fills" in node)) {
    sendStatus({
      title: "Unsupported selection",
      message: "Select a rectangle or any node that supports fills.",
      state: "error",
    });
    return;
  }

  const fills = node.fills;

  if (fills === figma.mixed || fills.length === 0) {
    sendStatus({
      title: "No fill detected",
      message: "Add a solid fill to check for a color token.",
      state: "info",
    });
    return;
  }

  const firstFill = fills[0];

  if (firstFill.type !== "SOLID") {
    sendStatus({
      title: "Unsupported fill type",
      message: "Only solid fills are supported for this check.",
      state: "error",
    });
    return;
  }

  const bound = firstFill.boundVariables?.color;
  const boundId = typeof bound === "string" ? bound : bound?.id;

  if (boundId) {
    const variable = await figma.variables.getVariableByIdAsync(boundId);
    const variableName = variable?.name ?? "Color variable";

    sendStatus({
      title: "Color token found",
      message: `Using variable: ${variableName}`,
      state: "found",
    });
    return;
  }

  const hex = rgbToHex(firstFill.color);

  sendStatus({
    title: "Missing color token?",
    message: `Fill color: ${hex} is not using a variable.`,
    state: "missing",
  });
};

inspectSelection();

figma.ui.onmessage = async (msg) => {
  if (msg?.type === "refresh") {
    await inspectSelection();
  }

  if (msg?.type === "apply-token") {
    try {
      await applyNearestTokenToSelection();
    } catch (error) {
      sendStatus({
        title: "Apply failed",
        message: "Could not apply a color token. Try refreshing.",
        state: "error",
      });
      console.error("Apply token error", error);
    }
  }
};

// TODO: Support strokes alongside fills.
// TODO: Handle multiple fills and pick the visible one.
// TODO: Add bulk scanning for multiple selections or pages.
