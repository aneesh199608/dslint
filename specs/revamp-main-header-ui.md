# Research & Draft Kit: Revamp Main Header UI

**Date**: 2025-12-19  
**Purpose**: Single-file ideation to produce spec, plan, and tasks drafts (no extra files). Use this as the starting canvas for a new feature. Replace placeholders, keep sections concise, and tailor to the existing stack.

**Where to place**: Copy this template to a single file at `specs/revamp-main-header-ui.md` (root of `specs/`, no subfolder).

## Quick Context (fill before drafting)

- **User Prompt / Goal**: Revamp only the top header container UI to match Figma; keep functionality unchanged; background white; main content padded/margined 16px.
- **Scope**: UI header area only (no nodes UI changes).
- **Critical Constraints**: No functional changes; keep existing behaviors; use the Figma header layout; dropdowns move into a single filter dropdown. Only 'Missing/All' remain in header as in Figma UI
- **Tech Stack**: TypeScript, Figma Plugin runtime, UI in `src/ui.html`/`src/code.ts`.
- **Similar Feature to Mirror**: Existing header layout and controls ordering.

## Codebase Touchpoints (identify once)

- **UI Structure**: `src/ui.html` (header markup, controls layout)
- **UI Styling**: `src/ui.html` (inline styles) or CSS blocks
- **UI Events**: `src/code.ts` (dropdown change, scan button, apply-all button)
- **Messages/State**: `src/messages.ts` (status text mapping)

## Spec Draft (fill these sections to formalize)

- **Feature**: Revamp Main Header UI  
- **Created**: 2025-12-19 | **Status**: Draft  
- **Input**: Redesign the header area to match Figma while preserving existing functionality and labels.

### User Stories (prioritized, independently testable)
- **US1 (P1)**: As a user, I see the updated header layout and styling that matches Figma with no change to behavior.
  - Acceptance:
    - Given the plugin UI loads, when I view the top header area, then it visually matches the Figma header layout and spacing.
    - Given existing controls (scan status, filters, scan again, apply token), when I use them, then functionality is unchanged.
- **US2 (P2)**: As a user, I can access light/dark and scope filters inside a single filter dropdown.
  - Acceptance:
    - Given the header, when I open the filter dropdown, then I see options for Light/Dark and Created in this file/others.
    - Given I select any filter option, then the behavior mirrors the current dropdown selections.
- **Edge Cases**: Long status text or high counts; narrow window widths; missing counts.

### Functional Requirements
- **FR-001**: Replace the current header layout with the Figma header layout (title, scan status, counts, filter dropdown, scan again).
- **FR-002**: Move existing dropdowns (Light/Dark and Created in this file/others) into a single filter dropdown labeled as filter control in the header.
- **FR-003**: Preserve existing IDs, data attributes, and event wiring to avoid functional changes.
- **FR-004**: Apply 16px padding/margin for the main content container area; header background stays white.
- **FR-005**: Keep the apply token button in the header block as shown in Figma (style-only change).

### Success Criteria
- **SC-001**: Visual parity with the Figma header layout and spacing for desktop and plugin window sizes.
- **SC-002**: No regressions in filter, scan, or apply behaviors.
- **SC-003**: All existing actions are still reachable and function as before.

## Plan Draft (implementation outline)

- **Date**: 2025-12-19 | **Spec**: `specs/revamp-main-header-ui.md`
- **Summary**: Update header markup and styling to match Figma; combine existing dropdowns into a single filter dropdown; keep logic unchanged; add 16px container padding.
- **Technical Context**: TypeScript + Figma plugin APIs; UI is `src/ui.html` + `src/code.ts`.
- **Project Structure**: Single project (`src/` for logic/UI; `specs/` for docs).
- **Constitution Check**: Non-destructive first, deterministic/offline, scope-respecting, minimal UI churn.

### Steps
1) Audit current header markup and CSS in `src/ui.html` to identify existing controls and handlers.
2) Map Figma header layout to existing elements; decide which elements are restyled vs restructured.
3) Update header layout structure, ensuring no changes to IDs or event hooks.
4) Replace two dropdowns with a single filter dropdown container (UI-only grouping) while preserving underlying options and handlers.
5) Apply 16px padding/margin to the main content container; keep background white.
6) Visual QA: compare header layout to Figma at typical plugin widths; confirm behavior unchanged.

## Tasks Draft (story-grouped)

### Phase 1: Discovery
- [ ] T01 [US1] Inspect current header structure and control IDs in `src/ui.html`.
- [ ] T02 [US2] Identify current dropdown wiring in `src/code.ts`.

### Phase 2: Header Revamp
- [ ] T03 [US1] Update header layout markup to match Figma hierarchy without changing IDs.
- [ ] T04 [US2] Consolidate Light/Dark and Created in this file/others into a single filter dropdown UI container.
- [ ] T05 [US1] Update header styling to match Figma (spacing, pill counts, button styles), white background.

### Phase 3: Container Spacing
- [ ] T06 [US1] Apply 16px padding/margin to the main content container.

### Phase 4: Validation
- [ ] T07 [US1] Verify scan status, filters, and actions behave identically.
- [ ] T08 [US1] Check header responsiveness at narrow widths.

## Open Questions (fill before build)

- Confirm label text casing: "Scan Complete" vs "Scan complete". - Scan Complete.
- Confirm exact count labels and badge colors for Applied/Missing/Unsupported. - count is just text but boldened. like 'Applied:' is regular while '48' will be in bold. it has a label - applied - #EBFFEE , missing - #FEE9E7 , unsupported - #FFFBEB 
- Confirm desired order of header controls on narrow widths (wrap vs overflow). it shouldn't overflow
- Should filter dropdown show a single combined selection state or multiple checkmarks? - combined selection state

---

**How to use**: This single file is the working doc for spec, plan, and tasks for the header revamp.***
