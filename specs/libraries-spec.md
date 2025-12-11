# Research & Draft Kit: Library Selection for Tokens

**Date**: 2025-12-10  
**Purpose**: Define how users choose which Figma libraries to use when scanning/applying tokens, adding a Libraries dropdown (alongside Light/Dark) that mirrors the native variable picker options (All libraries, Created in this file, specific published kits).

**Where to place**: `specs/libraries-spec.md`

## Quick Context (fill before drafting)

- **User Prompt / Goal**: Let users pick a library scope (All libraries, Created in this file, specific kits like “iOS and iPadOS 26”) for token matching/apply; defaults to current behavior (Created in this file).
- **Scope**: Current selection scanning + apply flows in this document; the dropdown lives in the plugin UI top bar, beside Light/Dark.
- **Critical Constraints**: Respect libraries enabled for the file; avoid binding to libraries the user cannot access; keep offline/local behavior intact; do not regress default “Created in this file” matching.
- **Tech Stack**: TypeScript Figma plugin; token lookup helpers in `src/variables.ts`, `src/spacing.ts`, `src/typography.ts`; UI in `src/ui.html` with bridge in `src/code.ts`.
- **Similar Feature to Mirror**: Mode preference (Light/Dark) dropdown + apply-all flag plumbing; native Figma library picker UX shown in the provided screenshot.

## Codebase Touchpoints (identify once)

- **Library Discovery**: (new) helper for listing available/active libraries and their variable collections; likely lives in `src/libraries.ts`.
- **Lookup Helpers**: `src/variables.ts`, `src/spacing.ts`, `src/typography.ts` should accept a library scope and fetch vars accordingly (local only vs enabled libraries vs specific library id).
- **Scanner**: `src/scanner.ts` needs library-aware variable resolution to mark found/missing/info states based on the chosen scope.
- **Apply Helpers**: `src/apply.ts` should pass the selected library scope into lookup/resolution so binding honors the user choice.
- **UI/Bridge**: `src/ui.html` adds the Libraries dropdown; `src/code.ts` forwards selection to scan/apply messages; consider persisting choice (e.g., `figma.clientStorage`).
- **Types/Status**: `src/types.ts` to include a `LibraryScope` type and carry it through plugin messages/status if needed.

## Spec Draft (formalize)

- **Feature**: User-selectable library scope for token scanning and apply  
- **Created**: 2025-12-10 | **Status**: Draft  
- **Input**: “Let me choose which library (All, Created in this file, specific kits) the plugin uses when matching/applying tokens.”

### User Stories (prioritized, independently testable)
- **US1 (P1)**: As a designer, I can pick a library from a Libraries dropdown (default “Created in this file”), and scans/apply actions only use tokens from that scope.  
  - Acceptance: Given the dropdown set to “Created in this file,” when I scan/apply a tokenizable node, only variables from the current file are considered, and matches outside this file are ignored. Switching to a named library limits matches to that library; “All libraries” widens to any enabled library.
- **US2 (P1)**: As a designer, I can change the library selection without reloading the plugin, and a rescan reflects the new scope.  
  - Acceptance: Given a prior scan with Library A, when I switch to Library B and hit Scan Again, results update based on Library B (different matches/messages), and Apply buttons bind variables from Library B.
- **US3 (P2)**: The dropdown lists only libraries available/enabled to me in the current file and handles inaccessible/disabled libraries gracefully.  
  - Acceptance: Given a library that is disabled or lacks access, it is either omitted or shown as unavailable; selecting it yields a clear status and reverts to a safe default without crashing.
- **Edge Cases**: Library removed mid-session, no libraries available beyond the file, mixed bindings across libraries in a single node, Light/Dark mode still respected for multi-mode variables, offline or API fetch failures.

### Functional Requirements
- **FR-001**: Add a Libraries dropdown in the top bar (beside Light/Dark) with options: `All libraries`, `Created in this file` (default), and each enabled/published library name (e.g., “iOS and iPadOS 26,” “Material 3 Design Kit,” “Simple Design System”).
- **FR-002**: Populate the dropdown from the Figma API for available/enabled libraries in the current file; exclude inaccessible/disabled libraries or mark them as unavailable.
- **FR-003**: Pipe the selected library scope into all variable lookups (color, spacing, typography, stroke weight, gap, padding, corner radius) for both scan and apply; default remains local-only when “Created in this file” is chosen.
- **FR-004**: Honor Light/Dark mode resolution alongside library scope (e.g., multi-mode variables in the chosen library respect the selected mode).
- **FR-005**: Persist the last selected library scope for the session (and optionally per-user via `clientStorage`) so scans/apply-all reuse it until changed.
- **FR-006**: Error handling: if fetching libraries fails or a selected library becomes unavailable, surface a non-blocking status and fall back to “Created in this file.”

### Success Criteria
- **SC-001**: Selecting a specific library leads to scans/apply actions binding variables only from that library (validated by variable ids/names in results).
- **SC-002**: “All libraries” mode discovers matches from any enabled library at parity with Figma’s native variable picker.
- **SC-003**: No regressions to the default local-file behavior; existing apply paths still work when the dropdown is untouched.
- **SC-004**: Library list loads quickly (<300 ms perceived) and does not block UI interactions; errors are surfaced without crashes.

## Plan Draft (implementation outline)

- **Date**: 2025-12-10 | **Spec**: specs/libraries-spec.md
- **Summary**: Introduce a Libraries dropdown, fetch available/enabled libraries, and route the chosen scope through scan/apply token lookups so users can target local, specific, or all libraries.
- **Technical Context**: TypeScript + Figma plugin APIs; current lookup helpers only use `getLocalVariablesAsync`; need library-aware fetching and UI plumbing without regressing Light/Dark resolution.
- **Project Structure**: Single plugin project (`src/` logic/UI, `specs/` docs).
- **Constitution Check**: Non-destructive; respect user access and library enablement; keep scans deterministic/offline; minimal UI churn.

### Steps
1) Library data: investigate Figma APIs for listing enabled/published libraries and their variable collections; model a `LibraryScope` (all | local | libraryId).  
2) UI control: add Libraries dropdown beside Light/Dark; populate on load; reflect current selection; show loading/error states succinctly.  
3) Bridge: include library scope in plugin messages (`refresh`, `apply-token`, `apply-token-all`, `highlight`) and persist selection (session + optional `clientStorage`).  
4) Lookup helpers: update color/spacing/typography resolvers to accept `libraryScope` and fetch variables from the chosen library set (local-only, specific library, or all enabled).  
5) Scanner: pass scope into scan routines so state/messages reflect the selected library; avoid mixing libraries when a specific one is chosen.  
6) Apply flows: ensure per-row and bulk apply respect the scope and bind variables from the selected library; keep Light/Dark mode resolution intact.  
7) Validation: manual runs for (a) local-only, (b) specific external library, (c) all libraries; confirm graceful fallback when a library is unavailable mid-session.

## Tasks Draft (story-grouped)

### Phase 1: Foundations & UI
- [ ] T01 [US1] Add `LibraryScope` model + fetch helper for available/enabled libraries.
- [ ] T02 [US1] Render Libraries dropdown in `src/ui.html` (next to Light/Dark) with loading/error/empty states.
- [ ] T03 [US2] Persist selection in UI state and pass it with outgoing plugin messages.

### Phase 2: Lookup & Scan
- [ ] T04 [US1] Update variable lookup helpers (color/spacing/typography) to filter by `libraryScope`.
- [ ] T05 [US1] Thread scope through `scanSelection` so matches/missing derive from the selected library only.
- [ ] T06 [US3] Handle unavailable/disabled libraries gracefully during scan (fallback + status).

### Phase 3: Apply Flows
- [ ] T07 [US2] Ensure per-row `apply-token` uses scoped lookup and re-scan honors the chosen library.
- [ ] T08 [US2] Ensure `apply-token-all` respects scope and does not bind tokens from outside the selected library.

### Phase 4: Persistence & Validation
- [ ] T09 [US2] Store last-used library scope (session + optional `clientStorage`) and restore on load.
- [ ] T10 [P] Manual validation: local-only, specific library, all libraries; verify Light/Dark resolution still accurate.
- [ ] T11 [P] Add status/error messaging for library fetch failures or mismatched permissions.

## Open Questions (fill before build)

- Which exact Figma APIs provide enabled library lists + variable collections to plugins, and do they require additional permissions?  - Direct answer: Use the Team Library and Variables plugin APIs: figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync() (returns enabled library variable collections) and figma.teamLibrary.getVariablesInLibraryCollectionAsync(libraryCollectionKey) (returns variables in a given enabled library collection); additionally use figma.variables methods for local collections such as figma.variables.getLocalVariableCollectionsAsync() when working with in-file collections. These Team Library APIs require the teamLibrary permission in the plugin manifest; they only return data for libraries that are manually enabled for the current file and will fail or reject if the plugin lacks permission or the user does not have access to the library.

​

What each API provides and permission details
Enabled library variable collections

    figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync() — returns descriptors for all VariableCollection objects that exist in libraries that are enabled for the current file; it requires that the libraries be enabled via the Figma UI.

​

Permission required: include "teamlibrary" in the plugin manifest permissions array to use teamLibrary methods; otherwise calls will throw errors.

    ​

Variables within a library collection

    figma.teamLibrary.getVariablesInLibraryCollectionAsync(libraryCollectionKey) — returns descriptors for all Variables in the specified LibraryVariableCollection and rejects if the collection does not exist or the user lacks access to the library.

​

Typical flow: call getAvailableLibraryVariableCollectionsAsync(), pick a collection key, then call getVariablesInLibraryCollectionAsync(key) to enumerate variables and optionally import them via figma.variables.importVariableByKeyAsync(...).

    ​

Local variable collections (in-file)

    figma.variables.getLocalVariableCollectionsAsync() — returns local variable collections present in the current file; use figma.variables.* APIs to create, extend, or import variables into the file.

​

No teamLibrary permission is needed to access local collections, but library-based collections require both the libraries to be enabled and the "teamlibrary" permission in manifest.json.

    ​

Notes and edge cases

    Plugins cannot programmatically enable libraries for the file; users must enable libraries manually in the UI for those APIs to surface library collections and variables.

​

Access will fail if the user’s account does not have access to the library or if the manifest omits the required permission.

    ​

If desired, an example snippet and manifest fragment can be provided showing the call sequence and the required "teamlibrary" permission.
getAvailableLibraryVariableCollectionsAsync

Returns a descriptor of all VariableCollections that exist in the enabled libraries of the current file. Rejects if the request fails.

This requires that users enable libraries that contain variables via the UI. Currently it is not possible to enable libraries via the Plugin API.
Signature
getAvailableLibraryVariableCollectionsAsync(): Promise<LibraryVariableCollection[]>

https://developers.figma.com/docs/plugins/api/properties/figma-teamlibrary-getavailablelibraryvariablecollectionsasync/
https://developers.figma.com/docs/plugins/api/figma-teamlibrary/
https://developers.figma.com/docs/plugins/api/properties/figma-teamlibrary-getvariablesinlibrarycollectionasync/


- Should “All libraries” include disabled-but-available libraries, or only those enabled in the current file?- include disabled but available libraries  
- Do we support styles/components too, or only variables? - styles and variables, components not required for now  
- Should the dropdown show availability state (icon/label) or hide inaccessible libraries entirely? - hide inaccessible libraries  
- Should selection persist per file or globally across files for the user? - persist per file

---

**How to use**: This single file is the working doc for spec, plan, and tasks for the library-selection feature. Use the screenshot flow (All libraries / Created in this file / specific kits) as the UX reference, and keep default behavior unchanged when the dropdown is untouched.
