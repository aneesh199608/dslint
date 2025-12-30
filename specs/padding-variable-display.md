# Research & Draft Kit: Padding Variable Display

**Date**: 2025-12-30  
**Purpose**: Single-file ideation to produce spec, plan, and tasks drafts (no extra files). Use this as the starting canvas for a new feature. Replace placeholders, keep sections concise, and tailor to the existing stack.

**Where to place**: Copy this template to a single file at `specs/[feature-name].md` (root of `specs/`, no subfolder).

## Quick Context (fill before drafting)

- **User Prompt / Goal**: Show which variables are bound to padding in the status message, instead of “Padding bound to variable(s)”.
- **Scope**: Selection / current page / document (same as existing spacing scan/apply flows).
- **Critical Constraints**: Offline; no new tokens; only display text changes; no mutation outside explicit apply.
- **Tech Stack**: TypeScript, Figma Plugin runtime, existing spacing resolver in `src/spacing.ts`, UI in `src/ui.html`/`src/code.ts`.
- **Similar Feature to Mirror**: Existing padding tokenization/feedback flow.

## Codebase Touchpoints (identify once)

- **Scanning**: `src/scanner.ts` (collect state, mark missing/found/info)
- **Apply Helpers**: `src/apply.ts` (per-target apply, bulk apply)
- **Resolvers**: `src/spacing.ts` (numeric spacing variables; reuse)
- **Selection/Scope**: `src/selection.ts`, `src/code.ts` (scope flags for bulk apply)
- **UI**: `src/ui.html` (row status + per-row action buttons), `src/messages.ts` (status), `src/highlight.ts` (optional)
- **Types**: `src/types.ts` (surface new info in scan results)

## Spec Draft (fill these sections to formalize)

- **Feature**: Padding Variable Display  
- **Created**: 2025-12-30 | **Status**: Draft  
- **Input**: Show precise padding variable bindings in the success message.

### User Stories (prioritized, independently testable)
- **US1 (P1)**: As a user, when padding values are bound to variables, I see the bound variable names (grouped) in the status line instead of a generic message.
  - Acceptance:
    - Given all four paddings are bound to the same variable, when scan completes, then the status shows `Padding: spacing/2`.
    - Given paddings are bound to different variables, when scan completes, then the status shows `Padding: L:spacing/2, R:spacing/3, T:spacing/4, B:spacing/5`.
    - Given L/R share a variable and T/B share another, then the status shows `Padding: L,R: spacing/2, T,B: spacing/3`.
- **US2 (P2)**: As a user, I can still apply padding tokenization without any behavior change; only the messaging becomes more specific.
- **US3 (P3)**: As a user, if any padding side lacks a bound variable, I see partial info with explicit `(unbound)` sides.
- **Edge Cases**: Mixed bound/unbound sides, zero padding, nodes with horizontal/vertical padding only, auto-layout constraints that do not expose all sides, nodes without padding support.

### Functional Requirements
- **FR-001**: Replace generic “Padding bound to variable(s)” text with a grouped variable list when all 4 sides are bound.
- **FR-002**: Group identical variables across sides (e.g., L,R or T,B), preserving a stable side order.
- **FR-003**: Keep current apply logic; this change is display-only for the success/info message.
- **FR-004**: If any side lacks a variable binding, show partial info with explicit `(unbound)` sides (e.g., `L: spacing/2, R: (unbound)`), still grouped when possible.
- **FR-005**: If multiple variables match the same numeric value during apply, prefer names containing “padding” over “spacing” using a simple substring score; keep resolver order as a tie-breaker.
- **FR-006**: Respect scope and node selection; do not alter padding values or bindings as part of display.

### Success Criteria
- **SC-001**: Users can see the exact variables bound to padding without extra clicks.
- **SC-002**: No changes to apply behavior or mutation timing.
- **SC-003**: Messages are deterministic and stable across scans.
- **SC-004**: No performance impact on scans over ~200 nodes.

## Plan Draft (implementation outline)

- **Date**: 2025-12-30 | **Spec**: `specs/padding-variable-display.md`
- **Summary**: Add grouped padding variable names to scan result messages, reusing existing padding binding detection.
- **Technical Context**: TypeScript + Figma plugin APIs; offline; reuse spacing resolver; UI is `src/ui.html` + `src/code.ts`.
- **Project Structure**: Single project (`src/` for logic/UI; `specs/` for docs).
- **Constitution Check**: Non-destructive first, deterministic/offline, scope-respecting, minimal UI churn.

### Steps
1) Scan/Types: locate where padding variable binding is detected; extend scan result to carry per-side variable names.  
2) Formatter: implement a small formatter to group sides by identical variable name; output strings like `L,R: spacing/2` in a stable order.  
3) Status text: use the formatter for padding “bound” status; display partial info with `(unbound)` for mixed cases.  
4) Apply priority note: when resolving equal numeric matches, score name substrings (`padding` > `spacing`) and use resolver order for ties.  
5) UI: ensure the status line renders the new text without layout regressions.  
6) Validation: manual scan on nodes covering all-same, all-different, grouped (LR/TB), and mixed bound/unbound cases.

## Tasks Draft (story-grouped)

### Phase 1: Scan & Types
- [ ] T01 [US1] Identify padding binding detection and expose per-side variable names in scan result type (`src/types.ts`, `src/scanner.ts`).
- [ ] T02 [US1] Add grouping/formatting helper with deterministic side order (L, R, T, B).

### Phase 2: Status Messaging
- [ ] T03 [US1] Replace generic “Padding bound to variable(s)” with formatted variable grouping when all sides are bound.
- [ ] T04 [US3] Implement mixed bound/unbound formatting with explicit `(unbound)` sides.
- [ ] T04b [US2] Add deterministic priority scoring for apply matching: “padding” substring > “spacing” substring > resolver order.

### Phase 3: UI & Validation
- [ ] T05 [US1] Confirm `src/ui.html` renders new status without clipping.
- [ ] T06 [P] Manual validation on sample nodes with 3 scenarios (all-same, all-different, grouped).

## Padding Status Text Variations (agreed outputs)

- All 4 sides bound, same variable: `Padding: spacing/2`
- All 4 sides bound, grouped: `Padding: L,R: spacing/2, T,B: spacing/3`
- All 4 sides bound, all different: `Padding: L:spacing/2, R:spacing/3, T:spacing/4, B:spacing/5`
- Mixed bound + unbound: `Padding: L,R: spacing/2, T: (unbound), B: spacing/4`
- Only one side bound: `Padding: L: spacing/2, R: (unbound), T: (unbound), B: (unbound)`
- None bound: `Padding: (unbound)` or keep existing non-variable message
- Not applicable / unsupported node: `Padding: not applicable`
- Padding not set / zero: `Padding: 0` or keep current numeric info status (if it exists)
- Error / unknown binding: `Padding: unknown binding`

## Open Questions (fill before build)

- Should shorthand variants use `H`/`V` or stick to `L,R` and `T,B` for clarity? -stick to `L,R` and `T,B` for clarity

---

**How to use**: Copy this file to `specs/[feature-name].md`, replace placeholders, and elaborate per section. This single file becomes your working doc for spec, plan, and tasks for the feature. Use an existing feature (e.g., corner-radius) as a reference for language and flow.***
