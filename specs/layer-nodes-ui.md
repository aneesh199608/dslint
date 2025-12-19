## Quick Context (fill before drafting)

- **User Prompt / Goal**: Implement layer nodes UI that showcases each node with expand/collapse, apply-all-per-layer action, hover highlight, and status lines styled by token match state.
- **Scope**: UI list for scan results (per-node cards) plus apply-per-layer action; no new scanning logic beyond formatting/interaction.
- **Critical Constraints**: Match provided screenshots; remove “matches variable” copy; color communicates match status; collapsed state shows header only.
- **Tech Stack**: TypeScript, Figma Plugin runtime, UI in `src/ui.html`/`src/code.ts`.
- **Similar Feature to Mirror**: Current scan results list rows in `src/ui.html` (per-property statuses + per-row apply buttons).

## Codebase Touchpoints (identify once)

- **UI**: `src/ui.html` (list rendering, buttons, highlight hover), `src/code.ts` (apply routing), `src/messages.ts` (if status text centralized)
- **Scan Results Shape**: `src/types.ts` (NodeScanResult and per-property info)
- **Apply Helpers**: `src/apply.ts` (per-target apply for fill/stroke/padding/gap/strokeWeight/cornerRadius/typography)
- **Highlight**: `src/highlight.ts` (hover highlight behavior)

## Spec Draft (fill these sections to formalize)

- **Feature**: Layer Nodes UI (Expanded/Collapsed)  
- **Created**: 2025-12-19 | **Status**: Draft  
- **Input**: “Implement the layer nodes UI with apply layer tokens, hover highlight icon, and expand/collapse behavior; update status text to show token names only, color-coded by state.”

### Visual Reference (from screenshots)
- **Expanded Row** (`codex-clipboard-c0buTf.png`):
  - Header: layer name on left; right side shows “Apply Layer Tokens” button, hover highlight icon, and collapse chevron.
  - Status lines:
    - `Fill: Text/Warning/Tertiary` (green)
    - `Stroke: Text/Warning/Tertiary` (green)
    - `Padding: L:Scale 03 R:Scale 03 T:Scale 01 B:Scale 01` (red)
    - `Gap: Scale 01` (red)
    - `Stroke weight: Unsupported stroke list` (orange)
    - `Corner radius: Space/200` (orange)
  - Action chips/buttons at bottom: “Apply Fill Token”, “Apply Padding Token”, “Apply Corner Radius Token”.
- **Collapsed Row** (`codex-clipboard-DSv4as.png`):
  - Only header row visible with layer name + actions.
  - Status lines and per-property buttons hidden.

### Figma Readings (node `3028:502`)
- **Status**: Figma read failed with API 429 (rate-limited).  
- **Fallback**: Use the screenshots + the user-provided behavior notes until Figma access is restored.

### User Stories (prioritized, independently testable)
- **US1 (P1)**: As a user, I can expand a layer row to see token matches and per-property apply actions.
  - Acceptance:
    - Given a layer row, clicking the chevron toggles expanded/collapsed states.
    - Expanded rows render all status lines and per-property apply buttons.
    - Collapsed rows show only the header.
- **US2 (P1)**: As a user, I can apply all missing tokens for a single layer using “Apply Layer Tokens”.
  - Acceptance:
    - Button triggers apply for all missing/eligible targets in that node only.
    - Button is disabled or hidden when there is nothing to apply.
- **US3 (P2)**: As a user, I can hover an icon to highlight the layer on canvas.
  - Acceptance:
    - Hovering the icon triggers highlight; leaving clears highlight.
- **US4 (P2)**: As a user, I can understand match state by color and concise status text.
  - Acceptance:
    - Status line text shows token name or brief reason (e.g., “Unsupported stroke list”); no “matches variable” phrasing.
    - Colors map to state: green (found/applied), red (missing), orange (unsupported/info).

### Functional Requirements
- **FR-001**: Render a card-like row per node with header (name + actions) and expandable body.
- **FR-002**: Add “Apply Layer Tokens” button that triggers apply for the specific node and respects scope/mode.
- **FR-003**: Add hover highlight icon in the header that uses existing highlight behavior.
- **FR-004**: Add expand/collapse icon; collapsed hides status lines and per-property buttons.
- **FR-005**: Update per-property status line copy to only show the token name or brief reason; remove “matches variable”.
- **FR-006**: Map status colors to state: found/applied = green, missing = red, unsupported/info = orange.
- **FR-007**: Keep per-property apply buttons (fill/padding/corner radius/etc.) in the expanded view only.

### Success Criteria
- **SC-001**: Expanded and collapsed rows visually match the provided screenshots.
- **SC-002**: Apply Layer Tokens affects only the targeted node and reflects state updates.
- **SC-003**: Highlight icon hover accurately highlights/unhighlights the node on canvas.
- **SC-004**: Status line text is concise and never uses “matches variable”.

## Plan Draft (implementation outline)

- **Date**: 2025-12-19 | **Spec**: `specs/layer-nodes-ui.md`
- **Summary**: Replace the flat row list with expandable layer cards and add a per-layer apply action, while simplifying status line copy and color coding.
- **Technical Context**: Update `renderList` in `src/ui.html` and route a new “apply-layer” action in `src/code.ts` and `src/apply.ts` if needed.
- **Project Structure**: UI is template-driven in `src/ui.html` with JS-based rendering and event handlers.
- **Constitution Check**: Non-destructive; no tokenization logic changes beyond UI formatting and per-node apply.

### Steps
1) UI Structure: Convert list rows to expandable cards; add header actions (apply-all, highlight, chevron).
2) State/Copy: Add expanded/collapsed state and update status text to token-only format.
3) Apply Per Layer: Add message type + apply helper to apply all missing tokens for a single node.
4) Styling: Add new styles for card layout, action buttons, and status colors.
5) Validation: Manual check vs screenshots; verify highlight and apply actions.

## Tasks Draft (story-grouped)

### Phase 1: UI Structure
- [ ] T01 [US1] Update `renderList` in `src/ui.html` to render per-node card with header/body.
- [ ] T02 [US1] Add expand/collapse state per node and toggle on chevron click.

### Phase 2: Status Copy + Colors
- [ ] T03 [US4] Update status message formatting to show token name/reason only.
- [ ] T04 [US4] Apply color mapping for found/applied/missing/unsupported info states.

### Phase 3: Actions
- [ ] T05 [US2] Add “Apply Layer Tokens” button and route a new message to apply all eligible tokens for a node.
- [ ] T06 [US3] Replace the current highlight button with header hover icon; keep hover behavior.
- [ ] T07 [US1] Show per-property apply buttons only in expanded view.

### Phase 4: QA
- [ ] T08 [P] Visual pass against screenshots for spacing/typography/icon placement.
- [ ] T09 [P] Manual apply-layer test on mixed-status node.

## Open Questions (fill before build)

- Can you share access or re-try the Figma node once rate limits clear to confirm spacing and typography?
- Should “Apply Layer Tokens” apply only missing tokens or also replace existing (found/applied) tokens? - replace only missing tokens
- Do we need a summary count in the collapsed state (e.g., “2 missing, 1 unsupported”) or keep it clean?, no need for summary cound, keep it clean.

---

**How to use**: Copy this file to `specs/[feature-name].md`, replace placeholders, and elaborate per section. This single file becomes your working doc for spec, plan, and tasks for the feature. Use an existing feature (e.g., corner-radius) as a reference for language and flow.
