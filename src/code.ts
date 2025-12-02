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

const pickModeId = (collection: VariableCollection, preferredModeName: string): string | null => {
  return (
    collection.modes.find(
      (mode) => mode.name.toLowerCase() === preferredModeName.toLowerCase()
    )?.modeId ??
    collection.modes.find((mode) => mode.modeId === collection.defaultModeId)?.modeId ??
    collection.modes[0]?.modeId ??
    null
  );
};

const resolveColorForMode = async (
  variable: Variable,
  preferredModeName: string
): Promise<RGB | null> => {
  if (variable.resolvedType !== "COLOR") return null;

  const resolveValue = async (
    value: VariableValue,
    preferredName: string,
    fallbackModeId: string
  ): Promise<RGB | null> => {
    if (typeof value === "object" && "type" in value && value.type === "VARIABLE_ALIAS") {
      const target = await figma.variables.getVariableByIdAsync(value.id);
      if (!target) return null;
      const targetCollection = await figma.variables.getVariableCollectionByIdAsync(
        target.variableCollectionId
      );
      if (!targetCollection) return null;
      const targetModeId = pickModeId(targetCollection, preferredName) ?? fallbackModeId;
      const next = target.valuesByMode[targetModeId];
      return next ? resolveValue(next, preferredName, targetModeId) : null;
    }
    const color = value as RGB & { a?: number };
    if (typeof color.r === "number") {
      return { r: color.r, g: color.g, b: color.b };
    }
    return null;
  };

  const collection = await figma.variables.getVariableCollectionByIdAsync(
    variable.variableCollectionId
  );
  if (!collection) return null;
  const modeId = pickModeId(collection, preferredModeName);
  if (!modeId) return null;

  const modeValue = variable.valuesByMode[modeId];
  if (!modeValue) return null;
  return resolveValue(modeValue, preferredModeName, modeId);
};

const findNearestColorVariable = async (color: RGB, preferredModeName = "Light") => {
  const variables = await figma.variables.getLocalVariablesAsync("COLOR");
  let bestMulti: { variable: Variable; distance: number } | null = null;
  let bestSingle: { variable: Variable; distance: number } | null = null;

  for (const variable of variables) {
    const collection = await figma.variables.getVariableCollectionByIdAsync(
      variable.variableCollectionId
    );
    if (!collection) continue;

    const variableColor = await resolveColorForMode(variable, preferredModeName);
    if (!variableColor) continue;

    const distance = rgbDistanceSq(color, variableColor);
    const isMultiMode = collection.modes.length > 1;

    if (isMultiMode) {
      if (!bestMulti || distance < bestMulti.distance) {
        bestMulti = { variable, distance };
      }
    } else {
      if (!bestSingle || distance < bestSingle.distance) {
        bestSingle = { variable, distance };
      }
    }
  }

  return (bestMulti ?? bestSingle)?.variable ?? null;
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

  const nearestVariable = await findNearestColorVariable(firstFill.color, "Light");

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
