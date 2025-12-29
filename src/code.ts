import { sendStatus } from "./messages";
import { scanSelection } from "./scanner";
import {
  applyAllMissing,
  applyAllMissingForNode,
  applyNearestTokenToNode,
  applyTypographyToNode,
  applyPaddingTokenToNode,
  applyGapTokenToNode,
  applyCornerRadiusTokenToNode,
} from "./apply";
import { highlightNode, restoreSelection } from "./highlight";
import { fetchLibraryOptions, LOCAL_LIBRARY_OPTION, resolveScopeFromId, runLibraryDiagnostics } from "./libraries";
import type { LibraryOption, LibraryScope, MatchSettings, ModePreference } from "./types";

const MIN_WIDTH = 480;
const MIN_HEIGHT = 720;
const DEFAULT_MODE: ModePreference = "Light";
const LIBRARY_STORAGE_KEY = "dslint:library-scope";

figma.showUI(__html__, { width: MIN_WIDTH, height: MIN_HEIGHT });

const getMode = (mode?: ModePreference): ModePreference =>
  mode === "Dark" ? "Dark" : "Light";

let libraryOptions: LibraryOption[] = [LOCAL_LIBRARY_OPTION];
let currentLibrary: LibraryOption = LOCAL_LIBRARY_OPTION;
let libraryError: string | undefined;
let librariesReady: Promise<void> | null = null;
let librariesNeedsRetry = false;
// Run diagnostics once at startup to log raw library API results.
runLibraryDiagnostics().catch((err) => {
  console.warn("Library diagnostics failed", err);
});

const sendLibraryOptionsToUI = () => {
  figma.ui.postMessage({
    type: "libraries-options",
    payload: {
      options: libraryOptions,
      selectedId: currentLibrary.id,
      error: undefined, // keep UI clean; errors handled via status/debug
    },
  });
};

const loadStoredLibraryId = async () => {
  try {
    const stored = await figma.clientStorage.getAsync(LIBRARY_STORAGE_KEY);
    return typeof stored === "string" ? stored : undefined;
  } catch (err) {
    console.warn("Failed to read stored library scope", err);
    return undefined;
  }
};

const persistLibraryId = async (id: string) => {
  try {
    await figma.clientStorage.setAsync(LIBRARY_STORAGE_KEY, id);
  } catch (err) {
    console.warn("Failed to persist library scope", err);
  }
};

const ensureLibrariesLoaded = async () => {
  if (!librariesReady || librariesNeedsRetry) {
    librariesNeedsRetry = false;
    librariesReady = (async () => {
      const storedId = await loadStoredLibraryId();
      try {
        const { options, error } = await fetchLibraryOptions();
        libraryOptions = options;
        libraryError = error;
        currentLibrary = resolveScopeFromId(libraryOptions, storedId ?? currentLibrary.id);
        // If we failed to load or only have local, allow retries on next call.
        if (error || libraryOptions.length <= 1) {
          librariesNeedsRetry = true;
        }
      } catch (error) {
        console.warn("Library option fetch failed; defaulting to local only", error);
        currentLibrary = resolveScopeFromId(libraryOptions, storedId ?? currentLibrary.id);
        librariesNeedsRetry = true;
      }
      sendLibraryOptionsToUI();
    })();
  }
  try {
    await librariesReady;
  } catch {
    librariesReady = null;
  }
};

const setLibrarySelection = async (libraryId?: string, persist?: boolean): Promise<LibraryScope> => {
  await ensureLibrariesLoaded();
  currentLibrary = resolveScopeFromId(libraryOptions, libraryId ?? currentLibrary.id);
  if (persist) {
    await persistLibraryId(currentLibrary.id);
  }
  sendLibraryOptionsToUI();
  return currentLibrary.scope;
};

const handleScan = async (
  mode?: ModePreference,
  libraryId?: string,
  settings?: MatchSettings
) => {
  const scope = await setLibrarySelection(libraryId, libraryId !== undefined);
  await scanSelection(getMode(mode), scope, settings);
};

handleScan(DEFAULT_MODE).catch((err) => console.error("Initial scan failed", err));

figma.ui.onmessage = async (msg) => {
  if (msg?.type === "ui-ready") {
    figma.ui.postMessage({
      type: "selection-state",
      payload: { hasSelection: figma.currentPage.selection.length > 0 },
    });
    return;
  }

  if (msg?.type === "refresh") {
    await handleScan(msg.mode, msg.libraryId, {
      allowClosestMatch: msg.allowClosestMatch,
    });
    return;
  }

  if (msg?.type === "set-library") {
    await setLibrarySelection(msg.libraryId, true);
    await handleScan(msg.mode ?? DEFAULT_MODE, msg.libraryId, {
      allowClosestMatch: msg.allowClosestMatch,
    });
    return;
  }


  if (msg?.type === "apply-token") {
    try {
      const scope = await setLibrarySelection(msg.libraryId, msg.libraryId !== undefined);
      const settings = { allowClosestMatch: msg.allowClosestMatch };
      if (msg.target === "typography") {
        await applyTypographyToNode(msg.nodeId, getMode(msg.mode), scope, settings);
      } else if (msg.target === "padding") {
        await applyPaddingTokenToNode(msg.nodeId, getMode(msg.mode), scope, settings);
      } else if (msg.target === "gap") {
        await applyGapTokenToNode(msg.nodeId, getMode(msg.mode), scope, settings);
      // Stroke weight tokenization disabled for this iteration.
      // } else if (msg.target === "strokeWeight") {
      //   await applyStrokeWeightTokenToNode(msg.nodeId, getMode(msg.mode), scope);
      } else if (msg.target === "cornerRadius") {
        await applyCornerRadiusTokenToNode(msg.nodeId, getMode(msg.mode), scope, settings);
      } else {
        await applyNearestTokenToNode(
          msg.nodeId,
          getMode(msg.mode),
          msg.target ?? "fill",
          scope,
          settings
        );
      }
      await handleScan(msg.mode, msg.libraryId, settings);
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

  if (msg?.type === "apply-token-layer") {
    try {
      const scope = await setLibrarySelection(msg.libraryId, msg.libraryId !== undefined);
      const settings = { allowClosestMatch: msg.allowClosestMatch };
      await applyAllMissingForNode(msg.nodeId, getMode(msg.mode), scope, settings);
      await handleScan(msg.mode, msg.libraryId, settings);
    } catch (error) {
      sendStatus({
        title: "Apply failed",
        message: "Could not apply tokens for that layer. Try refreshing.",
        state: "error",
      });
      console.error("Apply token layer error", error);
    }
    return;
  }

  if (msg?.type === "apply-token-all") {
    try {
      const scope = await setLibrarySelection(msg.libraryId, msg.libraryId !== undefined);
      const spacingFlag =
        msg.spacing !== undefined ? msg.spacing !== false : msg.padding !== false;
      const settings = { allowClosestMatch: msg.allowClosestMatch };
      await applyAllMissing(getMode(msg.mode), scope, {
        fills: msg.fills !== false,
        strokes: msg.strokes !== false,
        spacing: spacingFlag,
        typography: msg.typography !== false,
      }, settings);
      await handleScan(msg.mode, msg.libraryId, settings);
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
