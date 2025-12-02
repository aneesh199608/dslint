type StatusPayload = {
  title: string;
  message: string;
};

figma.showUI(__html__, { width: 360, height: 160 });

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

const inspectSelection = async () => {
  const selection = figma.currentPage.selection;

  if (selection.length !== 1) {
    sendStatus({
      title: "Select a layer or frame to inspect.",
      message: "Choose a single node with a fill to check for color tokens.",
    });
    return;
  }

  const node = selection[0];

  if (!("fills" in node)) {
    sendStatus({
      title: "Unsupported selection",
      message: "Select a rectangle or any node that supports fills.",
    });
    return;
  }

  const fills = node.fills;

  if (fills === figma.mixed || fills.length === 0) {
    sendStatus({
      title: "No fill detected",
      message: "Add a solid fill to check for a color token.",
    });
    return;
  }

  const firstFill = fills[0];

  if (firstFill.type !== "SOLID") {
    sendStatus({
      title: "Unsupported fill type",
      message: "Only solid fills are supported for this check.",
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
    });
    return;
  }

  const hex = rgbToHex(firstFill.color);

  sendStatus({
    title: "Missing color token",
    message: `Fill color: ${hex} is not using a variable.`,
  });
};

inspectSelection();

// TODO: Support strokes alongside fills.
// TODO: Handle multiple fills and pick the visible one.
// TODO: Add bulk scanning for multiple selections or pages.
