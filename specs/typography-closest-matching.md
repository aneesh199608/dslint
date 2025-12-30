# Research & Draft Kit: Typography Closest Matching (Family/Size/Weight)

**Date**: 2025-02-07  
**Purpose**: Single-file ideation to produce spec, plan, and tasks drafts (no extra files). Use this as the starting canvas for a new feature. Replace placeholders, keep sections concise, and tailor to the existing stack.

**Where to place**: Copy this template to a single file at `specs/typography-closest-matching.md` (root of `specs/`, no subfolder).

## Quick Context (fill before drafting)

- **User Prompt / Goal**: Closest typography matching should favor font family + size + weight; line height and letter spacing should not block a match.
- **Scope**: Selection scanning and apply (same as existing typography flow).
- **Critical Constraints**: Offline; no new tokens; keep exact-match behavior unchanged; only alter closest-match logic; avoid changing typography when no close match exists.
- **Tech Stack**: TypeScript, Figma Plugin runtime, typography resolver in `src/typography.ts`, UI in `src/ui.html`/`src/code.ts`.
- **Similar Feature to Mirror**: `specs/closest-matching-token.md` (closest matching toggle and thresholds), existing typography tokenization flow.

## Codebase Touchpoints (identify once)

- **Scanning**: `src/scanner.ts` (missing/found/info state; currently uses closest match thresholds)
- **Apply Helpers**: `src/apply.ts` (per-target apply; bulk apply)
- **Resolvers**: `src/typography.ts` (closest-match helper and thresholds)
- **Selection/Scope**: `src/selection.ts`, `src/code.ts`
- **UI**: `src/ui.html` (closest match toggle), `src/messages.ts` (status copy)
- **Types**: `src/types.ts` (settings and scan result structs)

## Spec Draft (fill these sections to formalize)

- **Feature**: Typography Closest Matching (Family/Size/Weight)  
- **Created**: 2025-02-07 | **Status**: Draft  
- **Input**: “Closest typography should match by font family + size + weight; ignore line height and letter spacing when deciding.”

### User Stories (prioritized, independently testable)
- **US1 (P1)**: As a user, when closest matching is enabled, I see a suggested typography token if font family + weight match and font size is close, even if line height/letter spacing differ.
  - Acceptance:
    - Given closest match enabled, a text node at size 15 matches a style at size 16 when family+weight match.
    - Given closest match enabled, a text node with mismatched line height/letter spacing still matches if family+weight+size are close.
- **US2 (P2)**: As a user, exact matches remain unchanged and still require full property equality.
- **US3 (P2)**: As a user, closest matches remain deterministic and do not apply if family/weight do not match.
- **Edge Cases**: Mixed typography; missing fonts; font style naming variations; italic vs regular; multiple styles at the same size.

### Functional Requirements
- **FR-001**: Exact-match logic remains unchanged (family, style/weight, size, line height, letter spacing).
- **FR-002**: Closest-match logic uses strict font family + font style/weight equality and a size tolerance; line height and letter spacing do not block a match.
- **FR-003**: Closest-match selection is deterministic: choose the smallest font size delta; tie-break by alphabetic style name or ID if needed.
- **FR-004**: UI/scan messaging indicates closest match when a near match is used.
- **FR-005**: Apply uses the same closest-match logic as scan to avoid mismatches.

### Closest-Match Logic (proposal)
- **Candidate filter**: `fontFamily === node.fontFamily` and `fontStyle === node.fontStyle`.
- **Accept**: `abs(style.fontSize - node.fontSize) <= 1px` (configurable threshold).
- **Score**: `abs(fontSizeDiff)` only; ignore line height/letter spacing.
- **Tie-break**: Lower fontSizeDiff; if equal, prefer style name lexicographically to avoid randomness.
- **Example**: Node 15px Regular -> Style 16px Regular is eligible; line height/letter spacing differences do not reject.

### Success Criteria
- **SC-001**: Closest matches appear for near font sizes even with line height/letter spacing differences.
- **SC-002**: Exact matches behave exactly as before with no regression.
- **SC-003**: No closest match is returned when family or weight/style differs.
- **SC-004**: Scan/apply use identical logic and results are deterministic.

## Plan Draft (implementation outline)

- **Date**: 2025-02-07 | **Spec**: `specs/typography-closest-matching.md`
- **Summary**: Adjust closest typography matching to focus on family + weight + size; ignore line height and letter spacing for nearest matching.
- **Technical Context**: TypeScript + Figma plugin APIs; offline; existing closest match toggle.
- **Project Structure**: Single project (`src/` logic/UI; `specs/` docs).
- **Constitution Check**: Non-destructive first; deterministic; scope-respecting; minimal UI churn.

### Steps
1) Spec alignment: Update `specs/closest-matching-token.md` and `specs/typography/typography-tokenization.md` to reflect new typography nearest-match criteria.
2) Resolver: Adjust `findClosestTypographyVariable` in `src/typography.ts` to only enforce font family/style and font size tolerance; ignore line height/letter spacing for acceptance and scoring.
3) Messaging: Ensure scan/apply message copy notes “closest match (size)” when line height/letter spacing differ.
4) Validation: Manual check with size 15 -> 16 match, line height mismatch, and style mismatch cases.

## Tasks Draft (story-grouped)

### Phase 1: Spec Updates
- [ ] T01 [US1] Update closest-match spec to describe typography matching by family+style+size; note line height/letter spacing are ignored for nearest.
- [ ] T02 [US2] Update typography tokenization spec to clarify exact-match vs closest-match behavior.

### Phase 2: Resolver + Messaging
- [ ] T03 [US1] Update `src/typography.ts` closest matcher to ignore line height/letter spacing in acceptance and scoring.
- [ ] T04 [US3] Add deterministic tie-break when multiple styles share the same font size diff.
- [ ] T05 [US1] Ensure status copy indicates “closest size match” when used.

### Phase 3: Validation
- [ ] T06 [P] Manual validation on samples: (15 -> 16 match; different line height/letter spacing; different font style; mixed text).

## Open Questions (fill before build)

- Should font size tolerance stay at 1px, or should it be configurable?  
- Should line height/letter spacing be used as a secondary tie-breaker when font sizes are equally close, or ignored entirely?
- How should italic vs regular be treated if they share the same family but different style names?

---

**How to use**: This single file is the working doc for spec, plan, and tasks for the feature. Use existing closest-matching specs for tone and flow.
