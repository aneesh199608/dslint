import { sendStatus } from "./messages";
import type { LibraryOption, LibraryScope, LibraryScopeKind } from "./types";

const DEFAULT_LIBRARY_ID = "local";
const ALL_LIBRARY_ID = "all";
const LIBRARY_FETCH_RETRIES = 6;
const LIBRARY_FETCH_DELAY_MS = 150;

const baseOption = (id: string, label: string, scope: LibraryScope): LibraryOption => ({
  id,
  label,
  scope,
});

export const LOCAL_LIBRARY_OPTION: LibraryOption = baseOption("local", "Created in this file", {
  type: "local",
});

let lastLibraryError: string | null = null;

const reportLibraryError = (message: string) => {
  if (!message || message === lastLibraryError) return;
  lastLibraryError = message;
  try {
    sendStatus({
      title: "Libraries unavailable",
      message,
      state: "error",
    });
  } catch {
    // Best-effort; avoid blocking on UI posting issues.
  }
};

const clearLibraryError = () => {
  lastLibraryError = null;
};

const scopeKey = (scope: LibraryScope) => {
  if (scope.type === "library") {
    return `${scope.libraryName}:${scope.collectionKeys.sort().join(",") || scope.id}`;
  }
  return scope.type;
};

const buildLibraryId = (libraryName: string, index: number) =>
  `library-${libraryName.toLowerCase().replace(/\s+/g, "-")}-${index}`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchAvailableCollections = async (): Promise<LibraryVariableCollection[]> => {
  let lastError: any;
  for (let attempt = 0; attempt < LIBRARY_FETCH_RETRIES; attempt++) {
    try {
      const collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
      if (collections.length === 0 && attempt < LIBRARY_FETCH_RETRIES - 1) {
        await sleep(LIBRARY_FETCH_DELAY_MS * (attempt + 1));
        continue;
      }
      return collections;
    } catch (err) {
      lastError = err;
      if (attempt < LIBRARY_FETCH_RETRIES - 1) {
        await sleep(LIBRARY_FETCH_DELAY_MS * (attempt + 1));
        continue;
      }
    }
  }
  if (lastError) throw lastError;
  return [];
};

export const fetchLibraryOptions = async (): Promise<{
  options: LibraryOption[];
  error?: string;
}> => {
  const options: LibraryOption[] = [LOCAL_LIBRARY_OPTION];
  if (!figma.teamLibrary || typeof figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync !== "function") {
    const error = "Library APIs not available in this environment.";
    reportLibraryError(error);
    return { options, error };
  }

  try {
    const collections = await fetchAvailableCollections();
    if (!collections.length) {
      const message =
        "No enabled libraries detected for this file. Turn on a published library to use its tokens.";
      reportLibraryError(message);
      // Allow caller to retry later; don't lock the empty state.
      return { options, error: message };
    }
    const byLibrary = new Map<string, Set<string>>();
    for (const col of collections) {
      const existing = byLibrary.get(col.libraryName) ?? new Set<string>();
      existing.add(col.key);
      byLibrary.set(col.libraryName, existing);
    }

    const sorted = Array.from(byLibrary.entries()).sort(([a], [b]) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
    sorted.forEach(([libraryName, keys], idx) => {
      options.push({
        id: buildLibraryId(libraryName, idx),
        label: libraryName,
        scope: {
          type: "library",
          id: buildLibraryId(libraryName, idx),
          libraryName,
          collectionKeys: Array.from(keys),
        },
      });
    });

    clearLibraryError();
    return { options };
  } catch (error: any) {
    const message =
      typeof error?.message === "string"
        ? error.message
        : "Unable to load libraries. Showing local variables only.";
    reportLibraryError(message);
    return { options, error: message };
  }
};

const cache = new Map<string, Promise<Variable[]>>();

export const runLibraryDiagnostics = async () => {
  const hasTeamLibrary = !!figma.teamLibrary;
    const hasApi =
      hasTeamLibrary &&
      typeof figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync === "function" &&
      typeof figma.teamLibrary.getVariablesInLibraryCollectionAsync === "function";
    console.info("[dslint][libraries][diag] teamLibrary present:", hasTeamLibrary, "APIs available:", hasApi);
    if (!hasApi) {
      const msg = "Library APIs unavailable; check manifest permissions and editor type.";
      reportLibraryError(msg);
      return;
    }
  try {
    const cols = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
    console.info("[dslint][libraries][diag] raw collections", cols);
    if (cols.length) {
      const first = cols[0];
      const vars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(first.key);
      console.info("[dslint][libraries][diag] first collection detail", {
        collection: { name: first.name, libraryName: first.libraryName, key: first.key },
        variablesCount: vars.length,
        sample: vars.slice(0, 3).map((v) => ({
          name: v.name,
          key: v.key,
          type: v.resolvedType,
        })),
      });
    }
  } catch (err) {
    console.error("[dslint][libraries][diag] collection fetch failed", err);
    const msg =
      typeof (err as any)?.message === "string"
        ? (err as any).message
        : "Library diagnostics failed; see console.";
    reportLibraryError(msg);
  }
};

const loadLibraryVariables = async (scope: LibraryScope, type: VariableResolvedDataType) => {
  if (!figma.teamLibrary) {
    reportLibraryError("Library APIs not available in this environment.");
    return [] as Variable[];
  }

  let available: LibraryVariableCollection[];
  try {
    available = await fetchAvailableCollections();
  } catch (err) {
    reportLibraryError("Unable to load enabled libraries for this file. Showing local variables only.");
    return [];
  }

  const targetCollections =
    scope.type === "all"
      ? available
      : available.filter((c) => scope.collectionKeys?.includes(c.key) || c.libraryName === scope.libraryName);

  const imported: Variable[] = [];
  let hadError = false;
  if (!targetCollections.length) {
    reportLibraryError("No enabled libraries detected for this file. Turn on a published library to use its tokens.");
    return [];
  }
  console.info("[dslint][libraries] Loading variables for scope", {
    scope,
    targetCount: targetCollections.length,
    targetCollections: targetCollections.map((c) => `${c.libraryName}::${c.name}`),
  });
  for (const collection of targetCollections) {
    try {
      const libraryVars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(collection.key);
      console.info("[dslint][libraries] Collection vars", {
        collection: `${collection.libraryName}::${collection.name}`,
        total: libraryVars.length,
        byType: libraryVars.reduce<Record<string, number>>((acc, v) => {
          acc[v.resolvedType] = (acc[v.resolvedType] ?? 0) + 1;
          return acc;
        }, {}),
      });
      for (const libVar of libraryVars) {
        if (libVar.resolvedType !== type) continue;
        try {
          const variable = await figma.variables.importVariableByKeyAsync(libVar.key);
          imported.push(variable);
        } catch (err) {
          console.warn("Import variable failed", { collection: collection.key, variable: libVar.name, err });
          hadError = true;
          reportLibraryError("Unable to import some variables from the selected library. Tokens may be incomplete.");
        }
      }
    } catch (err) {
      console.warn("Library variable fetch failed", { collection: collection.key, err });
      hadError = true;
      reportLibraryError("Unable to load variables from one or more libraries. Tokens may be incomplete.");
    }
  }

  if (!hadError) {
    clearLibraryError();
  }

  return imported;
};

export const getVariablesForScope = async (
  type: VariableResolvedDataType,
  scope: LibraryScope
): Promise<Variable[]> => {
  const key = `${type}:${scopeKey(scope)}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      (async () => {
        const locals = await figma.variables.getLocalVariablesAsync(type);
        if (scope.type === "local") return locals;

        let libraryVariables: Variable[] = [];
        let libraryFailed = false;
        try {
          libraryVariables = await loadLibraryVariables(scope, type);
        } catch (err) {
          console.warn("Library variable load failed; library tokens unavailable for this scope", {
            type,
            scope,
            err,
          });
          libraryVariables = [];
          libraryFailed = true;
        }
        const deduped = new Map<string, Variable>();
        const pool = scope.type === "all" ? [...locals, ...libraryVariables] : libraryVariables;
        pool.forEach((v) => deduped.set(v.id, v));
        const result = Array.from(deduped.values());
        if (libraryFailed || (scope.type !== "local" && result.length === 0)) {
          cache.delete(key);
        }
        return result;
      })()
    );
  }
  try {
    return await cache.get(key)!;
  } catch (err) {
    cache.delete(key);
    throw err;
  }
};

export const resolveScopeFromId = (options: LibraryOption[], id?: string): LibraryOption => {
  const fallback = options.find((o) => o.id === DEFAULT_LIBRARY_ID) ?? LOCAL_LIBRARY_OPTION;
  if (!id) return fallback;
  const found = options.find((o) => o.id === id);
  return found ?? fallback;
};

export const libraryIdFromScope = (scope: LibraryScope): string => {
  if (scope.type === "local") return DEFAULT_LIBRARY_ID;
  if (scope.type === "all") return ALL_LIBRARY_ID;
  return scope.id ?? `${scope.libraryName}-${scope.collectionKeys.join(",")}`;
};

export const libraryKindLabel = (kind: LibraryScopeKind) =>
  kind === "local" ? "Created in this file" : kind === "all" ? "All libraries" : "Library";
