# Research & Draft Kit: [FEATURE NAME]

**Date**: [DATE]  
**Purpose**: Single-file ideation to produce spec, plan, and tasks drafts (no extra files). Use this as the starting canvas for a new feature. Replace placeholders, keep sections concise, and tailor to the existing stack.

**Where to place**: Copy this template to a single file at `specs/[feature-name].md` (root of `specs/`, no subfolder).

## Quick Context (fill before drafting)

- **User Prompt / Goal**: [e.g., “Tokenize corner radius under Spacings apply”]
- **Scope**: [Selection / current page / document]
- **Critical Constraints**: [Offline, no new tokens, tolerance, etc.]
- **Tech Stack**: TypeScript, Figma Plugin runtime, existing spacing resolver in `src/spacing.ts`, UI in `src/ui.html`/`src/code.ts`.
- **Similar Feature to Mirror**: [e.g., padding tokenization flow]

## Codebase Touchpoints (identify once)

- **Scanning**: `src/scanner.ts` (collect state, mark missing/found/info)
- **Apply Helpers**: `src/apply.ts` (per-target apply, bulk apply)
- **Resolvers**: `src/spacing.ts` (numeric spacing variables; reuse)
- **Selection/Scope**: `src/selection.ts`, `src/code.ts` (scope flags for bulk apply)
- **UI**: `src/ui.html` (row status + per-row action buttons), `src/messages.ts` (status), `src/highlight.ts` (optional)
- **Types**: `src/types.ts` (surface new info in scan results)

## Spec Draft (fill these sections to formalize)

- **Feature**: [Name]  
- **Created**: [DATE] | **Status**: Draft  
- **Input**: [One-line user description]

### User Stories (prioritized, independently testable)
- **US1 (P1)**: [Primary flow; e.g., apply token via bulk + per-row button]
  - Acceptance: [Given/When/Then bullets]
- **US2 (P2)**: [Visibility/mismatch handling]
- **US3 (P3)**: [Scope control or optional UX]
- **Edge Cases**: [Mixed values, zeros, unsupported nodes, missing tokens]

### Functional Requirements
- **FR-001**: [Include feature in relevant checkbox/flow; e.g., Spacings]
- **FR-002**: [Reuse spacing resolver; no new tokens]
- **FR-003**: [Surface per-row apply button with target id; mirror padding]
- **FR-004**: [Handle unsupported/mixed values gracefully; info state only]
- **FR-005**: [Respect scope selections; do not mutate other properties]

### Success Criteria
- **SC-001**: [e.g., % of nodes auto-matched]
- **SC-002**: [Performance target on ~200 nodes]
- **SC-003**: [Zero unintended property changes]
- **SC-004**: [User confidence/clarity metric]

## Plan Draft (implementation outline)

- **Date**: [DATE] | **Spec**: [link to this file once copied]
- **Summary**: [One sentence: what to add, what to mirror]
- **Technical Context**: TypeScript + Figma plugin APIs; offline; reuse spacing resolver; UI is `src/ui.html` + `src/code.ts`.
- **Project Structure**: Single project (`src/` for logic/UI; `specs/` for docs).
- **Constitution Check**: Non-destructive first, deterministic/offline, scope-respecting, minimal UI churn.

### Steps
1) Types/Scan: add info shape, collect values/bound vars, mark states.  
2) Resolver: reuse spacing variable finder (no nearest unless explicitly allowed).  
3) Apply Helpers: per-target apply function; bulk include under appropriate flag.  
4) UI/Bridge: row status text + action button with `data-target`; route in `code.ts`.  
5) Logging/Status: meaningful status titles/messages; avoid altering unrelated props.  
6) Scope: ensure scan/apply honor selection/page/document flags.  
7) Validation: manual run on mixed selection (matched/missing/zero/mixed).

## Tasks Draft (story-grouped)

### Phase 1: Types & Scan
- [ ] T01 [US1] Add info type for [property] in `src/types.ts`.
- [ ] T02 [US1] Collect/bind state in `src/scanner.ts`; mark missing/found/info; avoid false “missing” when no exact match.

### Phase 2: Apply Logic
- [ ] T03 [US1] Implement apply helper in `src/apply.ts` (handle zero/mixed; exact matches only unless spec allows tolerance).
- [ ] T04 [US1] Wire bulk path in `applyAllMissing` behind correct flag.
- [ ] T05 [US1] Add `code.ts` routing for `apply-token` target.

### Phase 3: UI
- [ ] T06 [US1] Render status line and per-row button in `src/ui.html` (mirror padding pattern).
- [ ] T07 [US2] Ensure mismatch/unsupported states show as info, not actionable when no match.

### Phase 4: Scope & Polish
- [ ] T08 [US3] Confirm scope controls applied in scan/apply.
- [ ] T09 [P] Copy/status strings clarity; no property side-effects.
- [ ] T10 [P] Manual validation run on sample selection; note outcomes.

## Open Questions (fill before build)

- Do we allow nearest-match suggestions or exact-only?  
- Do we show per-corner binding or treat mixed as unsupported?  
- What tolerance (if any) should be used, and is it user-configurable?  
- Scope defaults: selection vs page vs document?

---

**How to use**: Copy this file to `specs/[feature-name].md`, replace placeholders, and elaborate per section. This single file becomes your working doc for spec, plan, and tasks for the feature. Use an existing feature (e.g., corner-radius) as a reference for language and flow.***
