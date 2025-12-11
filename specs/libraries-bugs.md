# Library scope bugs (current state)

## User symptom
- Plugin UI libraries dropdown only shows `All libraries` and `Created in this file` even though the Figma file has multiple enabled libraries (e.g., “iOS and iPadOS 26”, “Material 3 Design Kit”, “Simple Design System”).
- Selecting `All libraries` applies tokens created in this file only; external library tokens are not surfaced or bound.
- Manual Figma “Apply variable” UI does show those libraries and can apply their tokens, so access is available/enabled.

## Current implementation touchpoints
- `src/libraries.ts`
  - `fetchLibraryOptions()` calls `figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()` to build dropdown options. If the call errors, it returns only local/all with an error message.
  - `getVariablesForScope(type, scope)` -> `loadLibraryVariables(scope, type)` calls:
    - `figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()` (again)
    - `figma.teamLibrary.getVariablesInLibraryCollectionAsync(collection.key)` per collection
    - `figma.variables.importVariableByKeyAsync(libVar.key)` to bring them into the file
  - On failure, we log and fall back to locals.
- `src/code.ts`
  - `ensureLibrariesLoaded()` invokes `fetchLibraryOptions()` and sends options to UI.
  - `setLibrarySelection()` resolves the scope from dropdown and persists id.
  - `handleScan()`/apply handlers pass the resolved `LibraryScope` into scanning/apply.
- `src/variables.ts`, `src/spacing.ts`, `src/typography.ts`, `src/apply.ts`, `src/scanner.ts` now accept `LibraryScope` and call `getVariablesForScope`.

## Observed behavior (likely root causes)
- Despite `teamlibrary` permission being added to `manifest.json`, the plugin still only sees locals. This implies either:
  - `figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()` is returning an empty array or failing silently (caught and hidden by fallback), or
  - `getVariablesInLibraryCollectionAsync`/`importVariableByKeyAsync` is failing (caught), leaving only locals.
- The dropdown options are derived from `fetchLibraryOptions()`; if the API returns empty, no per-library options are added. That matches the observed UI.
- “Apply failed” happened previously because the permission was missing; now the error is masked by the fallback and results stay local-only.

## What to test/inspect next
1) Log/inspect return values & errors from:
   - `figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()`
   - `figma.teamLibrary.getVariablesInLibraryCollectionAsync(key)`
   - `figma.variables.importVariableByKeyAsync(key)`
   to see which call drops data for enabled libraries.
2) Confirm the file’s enabled libraries actually publish variables (not just components/styles) and that the user has access to those variables.
3) Check if `documentAccess: "dynamic-page"` or current permissions block teamLibrary variable calls in this environment.
4) Update UI to surface load errors (currently only a note) so users see when library fetch/import fails.

## Expected behavior
- Dropdown should list each enabled library by name (from teamLibrary API), in addition to or instead of the current `All libraries`/`Created in this file` defaults.
- Proposed: drop `All libraries` and show `Created in this file` plus each enabled library (“iOS and iPadOS 26”, “Material 3 Design Kit”, “Simple Design System”) to mirror Figma’s picker and avoid the broken aggregate state.
- When a specific library is chosen, scan/apply should import variables from that library and include them even when the current file has zero local variables.

## Files of interest
- `manifest.json` (permissions include `"teamlibrary"`)
- `src/libraries.ts` (fetch/build options, load library vars, fallback)
- `src/code.ts` (UI wiring + scope persistence)
- `src/variables.ts`, `src/spacing.ts`, `src/typography.ts`, `src/apply.ts`, `src/scanner.ts` (use scoped variable fetching)
