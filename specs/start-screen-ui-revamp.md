# Research & Draft Kit: Start Screen UI Revamp (Empty Selection)

**Date**: 2025-12-19  
**Purpose**: Single-file ideation to produce spec, plan, and tasks drafts (no extra files). Use this as the starting canvas for a new feature. Replace placeholders, keep sections concise, and tailor to the existing stack.

**Where to place**: Copy this template to a single file at `specs/[feature-name].md` (root of `specs/`, no subfolder).

## Quick Context (fill before drafting)

- **User Prompt / Goal**: Revamp the empty state UI shown when no layer or frame is selected; replace current copy (“Select a layer or frame to inspect. Choose a single node or frame to scan for color tokens.”) with the start screen design from Figma.
- **Scope**: UI empty state (no selection) in plugin UI.
- **Critical Constraints**: No code changes yet; output is a spec of what will be built; match Figma node `3009:1100`.
- **Tech Stack**: TypeScript, Figma Plugin runtime, UI in `src/ui.html`/`src/code.ts`.
- **Similar Feature to Mirror**: Existing empty-state view (current “Select a layer or frame…” screen).

## Codebase Touchpoints (identify once)

- **UI**: `src/ui.html` (empty state markup), `src/code.ts` (selection state branching), `src/messages.ts` (copy if centralized)
- **Selection**: `src/selection.ts` (detect no selection)

## Spec Draft (fill these sections to formalize)

- **Feature**: Start Screen UI Revamp (Empty Selection)  
- **Created**: 2025-12-19 | **Status**: Draft  
- **Input**: “Revamp UI of first start screen when no layer or frame is selected; use the Figma design.”

### Figma Readings (node `3009:1100`)
- **Frame**: `Start Screen` size 480x720, white background (`#FFFFFF`), 8px radius, vertical layout centered, padding 16, gap 16.
- **Title**: Text “Select a Layer or Frame to inspect” in Inter Regular 16px, line-height 1.4, color `#1E1E1E`.
- **Illustration Block**: `Picture` frame size 292x155, includes:
  - Cursor + comment pill group positioned within frame.
  - Comment pill background `#6A7796`, stroke `#555F78` (2px), radius `2px 24px 24px 24px`, shadow `4px 4px 10px rgba(106,119,150,0.16)`.
  - Comment text “apply tokens” in Inter Medium 16px, color `#FFFFFF`.
  - Outer rectangle stroke `#0F7CFF` at 8px, plus handle rectangles (22x22) with 4px stroke `#0F7CFF`.
- **CTA Button**: Primary button instance “Begin Scan” with start icon (note: product copy will use “Begin Scanning”).
  - Button background `#000000`, radius 8px, padding 12px 16px, gap 8px.
  - Label “Begin Scan” in Inter Bold 12px, color `#F5F5F5`.
  - Arrow right icon 16x16, color `#FFFFFF`.

### User Stories (prioritized, independently testable)
- **US1 (P1)**: As a user with no selection, I see the new empty-state layout with illustration and a “Begin Scanning” CTA.
  - Acceptance:
    - Given no selection, the UI matches the Figma layout, spacing, and colors.
    - The old two-line copy is replaced by the single title from the design.
- **US2 (P2)**: As a user, I can quickly understand what to do next via the illustration and CTA.
  - Acceptance:
    - Illustration and CTA are present and visually aligned with the title.

### Functional Requirements
- **FR-001**: When selection is empty, render the new layout modeled after Figma node `3009:1100`.
- **FR-002**: Replace existing empty-state copy with “Select a Layer or Frame to inspect”.
- **FR-003**: Show “Begin Scanning” button with the loader icon on the left; loader replaces the “Arrow right” icon in scanning state.
- **FR-004**: Include the illustrative graphic block as a single SVG asset sourced from the `Picture` frame (cursor/comment + bounding box), matching size and colors.
- **FR-005**: Maintain layout responsiveness within plugin UI frame (480x720 baseline) while preserving center alignment and padding.

### Success Criteria
- **SC-001**: Empty selection screen visually matches the Figma reference (layout, spacing, colors, typography).
- **SC-002**: The old two-line copy is removed or no longer visible in empty state.
- **SC-003**: No regressions in selection-detected states (selected node screens unchanged).
- **SC-004**: CTA transitions from “Begin Scanning” to “Scanning” with loader replacing the arrow icon when scan starts.

## Plan Draft (implementation outline)

- **Date**: 2025-12-19 | **Spec**: `specs/start-screen-ui-revamp.md`
- **Summary**: Update empty-state UI to match Figma design `3009:1099`, including title, illustration, and CTA.
- **Technical Context**: TypeScript + Figma plugin UI; update markup/CSS only in empty-state branch.
- **Project Structure**: UI in `src/ui.html` and state routing in `src/code.ts`.
- **Constitution Check**: Non-destructive, scope-limited to empty-state UI, no behavior changes beyond visuals.

### Steps
1) Inspect current empty-state markup and state branching to localize changes.
2) Implement the new layout structure (title, illustration block SVG, CTA) to match Figma.
3) Apply styles for typography, colors, spacing, and button visuals (loader + label).
4) Validate empty-state render in plugin window; ensure other states unaffected.

## Tasks Draft (story-grouped)

### Phase 1: UI Structure
- [ ] T01 [US1] Identify empty-state rendering branch in `src/ui.html`.
- [ ] T02 [US1] Add layout containers for title, illustration SVG, and CTA.

### Phase 2: Styling
- [ ] T03 [US1] Match typography, colors, and spacing from Figma node `3009:1099`.
- [ ] T04 [US1] Add illustration SVG asset sourced from `Picture` frame.

### Phase 3: QA
- [ ] T05 [US2] Manual visual check vs Figma reference.
- [ ] T06 [P] Confirm selection states still render as before.

## Open Questions (fill before build)

- Is the “Begin Scanning” CTA already wired in empty-state, or should it be purely visual for now?
- Do we want to keep any secondary helper text under the title, or strictly the single-line title from Figma?

---

**How to use**: Copy this file to `specs/[feature-name].md`, replace placeholders, and elaborate per section. This single file becomes your working doc for spec, plan, and tasks for the feature. Use an existing feature (e.g., corner-radius) as a reference for language and flow.
