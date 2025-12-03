import { sendStatus } from "./messages";
import { scanSelection } from "./scanner";
import { applyAllMissing, applyNearestTokenToNode, applyTypographyToNode } from "./apply";
import { highlightNode, restoreSelection } from "./highlight";
import type { ModePreference } from "./types";

const MIN_WIDTH = 480;
const MIN_HEIGHT = 720;
const DEFAULT_MODE: ModePreference = "Light";

figma.showUI(__html__, { width: MIN_WIDTH, height: MIN_HEIGHT });

const getMode = (mode?: ModePreference): ModePreference =>
  mode === "Dark" ? "Dark" : "Light";

const handleScan = async (mode?: ModePreference) => {
  await scanSelection(getMode(mode));
};

handleScan(DEFAULT_MODE);

figma.ui.onmessage = async (msg) => {
  if (msg?.type === "refresh") {
    await handleScan(msg.mode);
    return;
  }

  if (msg?.type === "apply-token") {
    try {
      if (msg.target === "typography") {
        await applyTypographyToNode(msg.nodeId, getMode(msg.mode));
      } else {
        await applyNearestTokenToNode(msg.nodeId, getMode(msg.mode), msg.target ?? "fill");
      }
      await handleScan(msg.mode);
    } catch (error) {
      sendStatus({
        title: "Apply failed",
        message: "Could not apply a color token. Try refreshing.",
        state: "error",
      });
      console.error("Apply token error", error);
    }
    return;
  }

  if (msg?.type === "apply-token-all") {
    try {
      await applyAllMissing(getMode(msg.mode), {
        fills: msg.fills !== false,
        strokes: msg.strokes !== false,
        typography: msg.typography !== false,
      });
      await handleScan(msg.mode);
    } catch (error) {
      sendStatus({
        title: "Apply failed",
        message: "Could not apply tokens to all nodes. Try refreshing.",
        state: "error",
      });
      console.error("Apply token all error", error);
    }
    return;
  }

  if (msg?.type === "ui-resized") {
    const width = Math.max(MIN_WIDTH, Number(msg.width) || MIN_WIDTH);
    const height = Math.max(MIN_HEIGHT, Number(msg.height) || MIN_HEIGHT);
    figma.ui.resize(width, height);
    return;
  }

  if (msg?.type === "highlight") {
    try {
      await highlightNode(msg.nodeId);
    } catch (error) {
      console.error("Highlight error", error);
    }
    return;
  }

  if (msg?.type === "highlight-clear") {
    try {
      await restoreSelection();
    } catch (error) {
      console.error("Highlight clear error", error);
    }
  }
};

// TODO: Support strokes alongside fills.
// TODO: Handle multiple fills and pick the visible one.
// TODO: Add bulk scanning for multiple selections or pages.
