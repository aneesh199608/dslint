type StatusState = "missing" | "found" | "applied" | "error" | "info";

type StatusPayload = {
  title: string;
  message: string;
  state?: StatusState;
};

const MIN_WIDTH = 480;
const MIN_HEIGHT = 720;

let originalSelectionIds: string[] = [];

figma.showUI(__html__, { width: MIN_WIDTH, height: MIN_HEIGHT });

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
  preferredModeName: "Light" | "Dark"
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
    return typeof color.r === "number" ? { r: color.r, g: color.g, b: color.b } : null;
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

const colorsEqual = (a: RGB, b: RGB) => {
  const eps = 1e-5;
  return Math.abs(a.r - b.r) < eps && Math.abs(a.g - b.g) < eps && Math.abs(a.b - b.b) < eps;
};

const findNearestColorVariable = async (color: RGB, preferredModeName: "Light" | "Dark") => {
  const variables = await figma.variables.getLocalVariablesAsync("COLOR");
  const exactMatches: { variable: Variable; isMulti: boolean }[] = [];
  let bestMulti: { variable: Variable; distance: number } | null = null;
  let bestSingle: { variable: Variable; distance: number } | null = null;

  for (const variable of variables) {
    const collection = await figma.variables.getVariableCollectionByIdAsync(
      variable.variableCollectionId
    );
    if (!collection) continue;

    const variableColor = await resolveColorForMode(variable, preferredModeName);
    if (!variableColor) continue;

    const isMultiMode = collection.modes.length > 1;

    if (colorsEqual(variableColor, color)) {
      exactMatches.push({ variable, isMulti: isMultiMode });
      continue;
    }

    const distance = rgbDistanceSq(color, variableColor);
    if (isMultiMode) {
      if (!bestMulti || distance < bestMulti.distance) bestMulti = { variable, distance };
    } else {
      if (!bestSingle || distance < bestSingle.distance) bestSingle = { variable, distance };
    }
  }

  if (exactMatches.length === 1) return exactMatches[0].variable;
  if (exactMatches.length > 1) {
    const multi = exactMatches.find((m) => m.isMulti);
    return (multi ?? exactMatches[0]).variable;
  }

  return (bestMulti ?? bestSingle)?.variable ?? null;
};

type NodeScanResult = {
  id: string;
  name: string;
  message: string;
  state: StatusState;
  hex?: string;
  variableName?: string;
};

const evalNodeFill = async (
  node: SceneNode,
  preferredModeName: "Light" | "Dark"
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

const gatherNodesWithFills = (nodes: readonly SceneNode[]): SceneNode[] => {
  const result: SceneNode[] = [];

  const walk = (node: SceneNode) => {
    if ("fills" in node) {
      result.push(node);
    }
    if ("children" in node) {
      for (const child of node.children) {
        walk(child);
      }
    }
  };

  for (const node of nodes) {
    walk(node);
  }

  return result;
};

const scanSelection = async (preferredModeName: "Light" | "Dark" = "Light") => {
  const selection = figma.currentPage.selection;
  originalSelectionIds = selection.map((n) => n.id);

  if (selection.length === 0) {
    sendStatus({
      title: "Select a layer or frame to inspect.",
      message: "Choose a single node or frame to scan for color tokens.",
      state: "info",
    });
    figma.ui.postMessage({ type: "scan-results", payload: { items: [] } });
    return;
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
};

const applyNearestTokenToNode = async (nodeId: string, preferredModeName: "Light" | "Dark") => {
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

const applyAllMissing = async (preferredModeName: "Light" | "Dark") => {
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

  await scanSelection(preferredModeName);
};

scanSelection("Light");

figma.ui.onmessage = async (msg) => {
  if (msg?.type === "refresh") {
    await scanSelection(msg.mode ?? "Light");
  }

  if (msg?.type === "apply-token") {
    try {
      await applyNearestTokenToNode(msg.nodeId, msg.mode ?? "Light");
      await scanSelection(msg.mode ?? "Light");
    } catch (error) {
      sendStatus({
        title: "Apply failed",
        message: "Could not apply a color token. Try refreshing.",
        state: "error",
      });
      console.error("Apply token error", error);
    }
  }

  if (msg?.type === "apply-token-all") {
    try {
      await applyAllMissing(msg.mode ?? "Light");
    } catch (error) {
      sendStatus({
        title: "Apply failed",
        message: "Could not apply tokens to all nodes. Try refreshing.",
        state: "error",
      });
      console.error("Apply token all error", error);
    }
  }

  if (msg?.type === "ui-resized") {
    const width = Math.max(MIN_WIDTH, Number(msg.width) || MIN_WIDTH);
    const height = Math.max(MIN_HEIGHT, Number(msg.height) || MIN_HEIGHT);
    figma.ui.resize(width, height);
  }

  if (msg?.type === "highlight") {
    try {
      const node = (await figma.getNodeByIdAsync(msg.nodeId)) as SceneNode | null;
      if (node) {
        figma.currentPage.selection = [node];
      }
    } catch (error) {
      console.error("Highlight error", error);
    }
  }

  if (msg?.type === "highlight-clear") {
    try {
      const restored: SceneNode[] = [];
      for (const id of originalSelectionIds) {
        const n = (await figma.getNodeByIdAsync(id)) as SceneNode | null;
        if (n) restored.push(n);
      }
      figma.currentPage.selection = restored;
    } catch (error) {
      console.error("Highlight clear error", error);
    }
  }
};

// TODO: Support strokes alongside fills.
// TODO: Handle multiple fills and pick the visible one.
// TODO: Add bulk scanning for multiple selections or pages.
