# Research & Draft Kit: Typography Tokenization

**Date**: 2025-12-10  
**Purpose**: Document the current typography token detection behavior, why applying text styles is blocked, and outline the spec/plan to ship typography tokenization + apply.

**Where to place**: Copied from `.specify/templates/research-template.md` into `specs/typography/`.

## Quick Context (fill before drafting)

- **User Prompt / Goal**: Typography tokenization should find matching tokens/text styles and let the plugin apply them (per-row and bulk) instead of only showing “coming soon”.
- **Scope**: Selection scanning on the current page (same as other token flows).
- **Critical Constraints**: Figma runtime lacks typography variable support; current logic falls back to exact text-style matches; only uniform text (no mixed fonts/sizes/line heights) is processed; letter spacing/paragraph spacing ignored.
- **Tech Stack**: TypeScript, Figma Plugin runtime, typography resolver in `src/typography.ts`, UI in `src/ui.html`/`src/code.ts`.
- **Similar Feature to Mirror**: Color/padding/stroke weight token apply flows (scan + per-row apply + bulk).

## Codebase Touchpoints (identify once)

- `src/typography.ts`: Extracts uniform text properties, compares to local text styles (variables unsupported), returns match info; apply helper exists but simply sets `textStyleId` and is unused.
- `src/scanner.ts`: Uses `findMatchingTypographyVariable`; reports bound textStyleId, matched style, or no match; all states marked `info` with “coming soon”.
- `src/apply.ts`: `applyTypographyToNode` is a placeholder showing “Typography coming soon”; not wired to actual application logic.
- `src/ui.html`: Renders typography status text; apply button rendered disabled with tooltip “coming soon”.
- `src/types.ts`: `TypographyInfo` shape (message/state/variableName) used in scan results.
- `specs/typography/typography-figma-doc.md`: Currently empty; no external figma doc content to reference.

## Current Findings

- Detection works only for uniform text nodes without missing fonts; compares `fontFamily`, `fontStyle`, `fontSize`, and normalized `lineHeight` (unit + value). Letter spacing and paragraph spacing are ignored, so matches may be false positives/negatives.
- Matching is against local text styles because typography variables are not supported in this environment; exact equality required (no tolerance except strict equality on numbers and line-height units/values).
- When a text node is already bound to a text style (`textStyleId`), the scan reports it as “Using typography style: <name>” (state `info`).
- When an exact style match is found, the scan reports “Typography: matches <style> (coming soon)” (state `info`).
- When no match is found, the scan reports “Typography: no matching token (coming soon)” (state `info`).
- UI apply button is disabled; `applyTypographyToNode` never invoked, so no apply happens. Even if called, it only shows “coming soon” and does not bind the style ID.
- `applyTypographyVariable` helper (sets `textStyleId`) is not referenced anywhere; no bulk apply path; no mode handling; no mixed-text safety beyond initial uniformity check.

## Spec Draft (fill these sections to formalize)

- **Feature**: Typography tokenization & apply  
- **Created**: 2025-12-10 | **Status**: Draft  
- **Input**: “Scan selected nodes for typography tokens/text styles and allow applying matching text styles.”

### User Stories (prioritized, independently testable)
- **US1 (P1)**: As a designer, when I scan selected text layers, matching text styles are identified and I can apply them per row or via bulk apply.  
  - Acceptance: Given a text layer matching a local text style, the row shows `found`/`missing` appropriately and “Apply Typography Token” enables; clicking applies the style and refreshes status to `applied/found`.
- **US2 (P2)**: When a text layer is already bound to a text style, the scan shows it as found/using style and does not offer apply.
- **US3 (P3)**: Unsupported or mixed cases (mixed fonts/sizes/line heights, missing fonts, non-text nodes) are surfaced as `info` without apply options and without mutation.
- **Edge Cases**: Mixed text styles in a node; AUTO/PERCENT/PIXELS line heights; letter/paragraph spacing differences; missing fonts; styles with mode-specific values (if variables later supported).

### Functional Requirements
- **FR-001**: Include typography in scan results with state `found/missing/info/error` consistent with other token types.
- **FR-002**: Exact-match resolver compares font family/style, font size, and line height; tolerate AUTO vs numeric correctly; document handling for letter/paragraph spacing (ignore or include).
- **FR-003**: Enable per-row typography apply button when a match exists and the node is not already bound; disable otherwise.
- **FR-004**: Implement apply path that sets `textStyleId` to the matched style (or typography variable when supported) and re-runs scan for refreshed status.
- **FR-005**: Bulk apply includes typography when enabled and only acts on nodes marked missing with a resolvable match; avoid mutating nodes without matches or with mixed styles.
- **FR-006**: Respect selection scope; avoid affecting non-text nodes; keep status messaging aligned with other token types.

### Success Criteria
- **SC-001**: Matching and apply succeed on 90%+ uniform text layers that have exact style definitions locally.
- **SC-002**: No mutations occur on unsupported/mixed text nodes; status remains informational.
- **SC-003**: Post-apply scan reflects applied status with correct style name; UI button disables accordingly.
- **SC-004**: Performance parity with existing scan/apply flows on typical selections (~200 layers) without noticeable lag.

## Plan Draft (implementation outline)

- **Date**: 2025-12-10 | **Spec**: specs/typography/typography-tokenization.md
- **Summary**: Wire typography resolver to apply text styles, mirror other token flows (per-row + bulk), and tighten detection scope to avoid mixed/unsupported states.
- **Technical Context**: TypeScript + Figma plugin APIs; typography variables unavailable, so bind local text styles; must handle uniform-only text safely.
- **Project Structure**: Single project (`src/` logic/UI; `specs/` docs); typography hooks already stubbed in scanner/apply/UI.
- **Constitution Check**: Non-destructive for unsupported nodes; deterministic matching; respect selection scope; minimize UI churn.

### Steps
1) Types/Scan: Extend `TypographyInfo` state handling to mark `found/missing/info`; carry matched style id/name; keep mixed/unsupported as info.
2) Resolver: Reuse `findMatchingTypographyVariable` or split into style finder; consider including letter/paragraph spacing or document deliberate omission.
3) Apply Helpers: Implement apply function to bind `textStyleId` (or variable when available); add mode handling if/when typography variables land.
4) Bulk Apply: Include typography in `applyAllMissing` guarded by match availability; avoid touching nodes already bound or unsupported.
5) UI/Bridge: Enable row apply button when actionable; wire `apply-token` for typography; update status text to reflect found/applied/missing.
6) Validation: Manual run on sample selection with bound/matched/missing/mixed cases; ensure statuses and apply behavior align with other token types.

## Open Questions (fill before build)

- Should letter spacing and paragraph spacing be part of the matching key? If ignored, document potential mismatches. - yes it should be part of it
- Do we need tolerance for font sizes/line heights (e.g., float precision) or keep strict equality? - strict equality
- Should we surface typography variables when the runtime supports them, and how to pick mode? - why mode is required, text styles are regardless of mode
- What status wording should represent “already bound” vs “match available” vs “unsupported/mixed”? - use similar to other tokenization like padding etc.
- Should bulk apply include typography by default or behind a toggle? - it should include when i choose a checkbox typography.
