# Research & Draft Kit: Closest Token Matching

**Date**: 2025-12-29  
**Purpose**: Single-file ideation to produce spec, plan, and tasks drafts (no extra files). Use this as the starting canvas for a new feature. Replace placeholders, keep sections concise, and tailor to the existing stack.

**Where to place**: Copy this template to a single file at `specs/color-closest-matching.md` (root of `specs/`, no subfolder).

## Quick Context (fill before drafting)

- **User Prompt / Goal**: Add "Allow closest token match" toggle; if exact token not available, apply the closest match within threshold (colors, typography, spacings).
- **Scope**: Selection / current page / document (same as existing tokenization flows).
- **Critical Constraints**: Offline; no new tokens; only apply within strict thresholds; keep current exact match behavior when toggle is off.
- **Tech Stack**: TypeScript, Figma Plugin runtime, UI in `src/ui.html`/`src/code.ts`, matching in `src/variables.ts`, `src/spacing.ts`, `src/typography.ts`.
- **Similar Feature to Mirror**: Existing color tokenization exact-match flow (`specs/color-tokenization.md`).

## Codebase Touchpoints (identify once)

- **Scanning**: `src/scanner.ts` (missing/found/info state; currently exact-only)
- **Apply Helpers**: `src/apply.ts` (per-target apply; bulk apply)
- **Resolvers**: `src/variables.ts` (color variable match), `src/spacing.ts` (numeric spacing), `src/typography.ts` (text styles)
- **Selection/Scope**: `src/selection.ts`, `src/code.ts`
- **UI**: `src/ui.html` (checkboxes + Apply button row), `src/messages.ts` (status)
- **Types**: `src/types.ts` (flags/settings; scan result structs)

## Spec Draft (fill these sections to formalize)

- **Feature**: Closest Token Matching  
- **Created**: 2025-12-29 | **Status**: Draft  
- **Input**: "Allow closest token match" toggle enables nearest token application with tight thresholds.

### User Stories (prioritized, independently testable)
- **US1 (P1)**: As a user, when a color token is not exact, I can enable a toggle so the closest color token is applied if it is within a strict threshold.
  - Acceptance:
    - Given toggle off, unbound colors without exact matches remain `info` (no apply button).
    - Given toggle on, unbound colors with a closest match within threshold appear as `missing` and can be applied.
- **US2 (P1)**: As a user, the closest match logic applies to spacings and typography with similar strict thresholds.
  - Acceptance:
    - Spacing matches only if within tolerance; choose higher value when equidistant (e.g., 5 with tokens 4 and 6 -> 6).
    - Typography matches only if font family/style match exactly and numeric differences are within threshold.
- **US3 (P2)**: As a user, I can see why a closest match is suggested (delta/threshold in message).
- **Edge Cases**: Mixed fills/typography; Auto spacing; missing fonts; zero values; low-opacity colors; multi-mode variables.

### Functional Requirements
- **FR-001**: Add `Allow closest token match` toggle under Color/Typography/Spacings checkboxes in `src/ui.html`.
- **FR-002**: Apply button height equals the checkbox+toggle column height; layout is a flex row with a left column (checkboxes + toggle) and right CTA.
- **FR-003**: Introduce a single settings flag (`allowClosestMatch`) sent from UI to scan/apply.
- **FR-004**: When `allowClosestMatch=false`, behavior remains exact-only across colors, spacings, typography.
- **FR-005**: When `allowClosestMatch=true`, scan marks closest-within-threshold as `missing` (actionable) and includes closest match info in message.
- **FR-006**: Apply uses the same closest-match logic as scan to avoid mismatches.
- **FR-007**: Thresholds are centralized constants and documented.
- **FR-008**: UI messaging differentiates exact matches vs nearest matches when the toggle is enabled.

### Closest-Match Threshold Logic (proposal)
- **Colors (Balanced)**:
  - Use `rgbDistanceSq` on effective channels (color * opacity) to compute distance.
  - Accept closest match only if:
    - `maxChannelDelta <= 0.02` (about 5/255), and
    - `alphaDelta <= 0.05`.
  - Ranking: lowest distance wins; if tie, prefer multi-mode variables (mirrors current behavior).
  - Example: `#FFFFFF` -> `#FAFAFA` passes; `#FFFFFF` -> `#F0F0F0` fails.
- **Spacings (Balanced)**:
  - For a value `v`, find nearest resolved token value `t`.
  - Accept only if `abs(t - v) <= 1`.
  - Tie-break: if two tokens are equally distant, choose the higher value (e.g., `4, 6` with `5` chooses `6`).
  - Example: `5` -> `6` passes; `3` -> `6` fails; `3` -> `4` passes (within 1).
- **Typography** (styles):
  - Only consider styles with exact font family + font style match.
  - Accept if:
    - `fontSizeDiff <= 1px`,
    - `lineHeightDiff <= 2px` (or same unit when percent),
    - `letterSpacingDiff <= 0.2px` (or same unit when percent).
  - Ranking: sum of normalized diffs; lowest wins.

### Success Criteria
- **SC-001**: Toggling off yields identical results to current behavior.
- **SC-002**: Closest match suggestions never exceed thresholds.
- **SC-003**: Apply produces deterministic results across scan/apply flows.
- **SC-004**: No regressions in bulk apply or per-row apply for exact matches.
- **SC-005**: Nearest-match copy is explicit and only shown when the toggle is enabled.

### UI Copy (Exact vs Nearest)
- **Exact match (unchanged)**: `Fill: Background/Default/Tertiary (token found)`
- **Nearest match (toggle on, within threshold)**: `Fill: Background/Default/Tertiary (nearest token found)`
- **No match (toggle off or on)**: Existing copy remains (e.g., `... is not using a variable (no exact token match)`).

## Plan Draft (implementation outline)

- **Date**: 2025-12-29 | **Spec**: `specs/color-closest-matching.md`
- **Summary**: Add a closest-match toggle in UI and extend color/spacing/typography matching with thresholded nearest selection.
- **Technical Context**: TypeScript + Figma plugin APIs; offline; existing exact-match flows.
- **Project Structure**: Single project (`src/` for logic/UI; `specs/` for docs).
- **Constitution Check**: Non-destructive first; deterministic; scope-respecting; minimal UI churn.

### Steps
1) UI/Settings: Add toggle under checkboxes; wire to `code.ts` message payload as `allowClosestMatch`.
2) Types: Add settings flag to `src/types.ts` and pass through scan/apply functions.
3) Colors: Add `findClosestColorVariable` in `src/variables.ts` using thresholds; update scan/apply to use it when enabled.
4) Spacings: Add nearest logic using tolerance and tie-break; reuse `findNearestSpacingVariable` or add a new helper that returns best + diff.
5) Typography: Add nearest-style match with thresholds; update scan/apply to use it when enabled.
6) Messaging: Add per-row message text that shows closest match and delta when within threshold; otherwise keep `info`.
7) Manual Validation: Check color example (#FFFFFF -> #FAFAFA), spacing examples (5 -> 6; 3 -> 6 fails), typography example (size + lineHeight within tolerance).

## Tasks Draft (story-grouped)

### Phase 1: UI + Settings
- [ ] T01 [US1] Add toggle to `src/ui.html` below checkboxes; adjust flex layout so Apply button height matches column.
- [ ] T02 [US1] Add `allowClosestMatch` to UI payload in `src/ui.html` and handle it in `src/code.ts`.

### Phase 2: Colors
- [ ] T03 [US1] Add closest color match helper in `src/variables.ts` with thresholds.
- [ ] T04 [US1] Update `src/scanner.ts` to mark `missing` when closest match within threshold and toggle is on.
- [ ] T05 [US1] Update `src/apply.ts` to apply closest match when toggle is on.

### Phase 3: Spacings
- [ ] T06 [US2] Add nearest spacing helper with tolerance + tie-break in `src/spacing.ts`.
- [ ] T07 [US2] Update spacing scan/apply to use nearest when toggle is on.

### Phase 4: Typography
- [ ] T08 [US2] Add nearest typography style matching (font family/style exact, numeric thresholds).
- [ ] T09 [US2] Update typography scan/apply to use nearest when toggle is on.

### Phase 5: Validation + Copy
- [ ] T10 [US3] Add status messages showing closest token and delta when used.
- [ ] T11 [P] Manual validation on mixed nodes, low-opacity colors, and Auto spacing.

## Open Questions (fill before build)

- Should thresholds be user-configurable, or fixed constants (v1)? - fixed constants
- For colors, is `maxChannelDelta` acceptable or should we use a perceptual metric (DeltaE)? -  choose whatever is better
- For typography percent line-height/letter-spacing, what percent tolerance is acceptable? - you can suggest
- Should spacing tolerance vary by scale (e.g., `max(1, value * 0.1)`)?

---

**How to use**: This single file is the working doc for spec, plan, and tasks for the feature. Use existing tokenization specs for tone and flow.
