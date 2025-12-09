---

description: "Task list for corner radius tokenization feature"
---

# Tasks: Corner Radius Tokenization

**Input**: Design documents from `/specs/corner-radius/corner-radius-tokenization.md` and `/specs/corner-radius/corner-radius-tokenization-plan.md`  
**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: No automated tests requested; validate via manual plugin run against sample selection.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm existing plugin scaffolding is sufficient.

- [ ] T001 [P] Validate current spacing variable resolver coverage for numeric spacing tokens in `src/spacing.ts`; note reuse plan for corner radius.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Baseline types and selection scanning to surface corner radius state.

- [ ] T002 [US1] Extend spacing types to include corner radius state/result fields in `src/types.ts`.
- [ ] T003 [US1] Update selection scanning to collect corner radius values and bound variable info (uniform and per-corner) in `src/scanner.ts`; mark state as `using`/`missing`/`error` similar to padding/gap.

**Checkpoint**: Corner radius appears in scan results with state + value.

---

## Phase 3: User Story 1 - Apply to Selected Nodes (Priority: P1) 🎯 MVP

**Goal**: Apply spacing tokens to corner radii via bulk “Apply Token to All” and per-row button, mirroring padding behavior.

**Independent Test**: Select nodes with varying radii; run bulk apply with Spacings checked; use per-row “Apply Corner Radius Token”; verify only radii change and correct token names appear in status/log.

### Implementation for User Story 1

- [ ] T010 [US1] Implement corner-radius token resolver by reusing spacing finder in `src/spacing.ts` (shared numeric matcher).
- [ ] T011 [US1] Add `applyCornerRadiusTokenToNode` function in `src/apply.ts` (uniform, per-corner, zero handling, tolerance reuse); ensure non-radius properties untouched.
- [ ] T012 [US1] Wire bulk path: include corner radius in `applyAllMissing` when Spacings option is enabled in `src/apply.ts`.
- [ ] T013 [US1] Add UI row status block for corner radius and button label “Apply Corner Radius Token” in `src/ui.html`; reuse row-apply wiring with `data-target="cornerRadius"`.
- [ ] T014 [US1] Handle `apply-token` messages for `cornerRadius` in `src/code.ts` routing to new apply helper.
- [ ] T015 [US1] Ensure results/status updates display applied token name for corner radius in `src/messages.ts`/UI render.

**Checkpoint**: Per-row button applies a matching spacing token to radius; bulk Spacings apply covers corner radius.

---

## Phase 4: User Story 2 - Review & Mismatch Handling (Priority: P2)

**Goal**: Surface unmatched radii with nearest suggestions and actions.

**Independent Test**: Include nodes with radii not present in tokens; run bulk apply; verify mismatch list shows nearest suggestion, allows skip/use-nearest, and applies accordingly.

### Implementation for User Story 2

- [ ] T020 [US2] When no exact spacing token match, compute nearest within padding tolerance in `src/spacing.ts` and surface suggestion on scan/apply result model.
- [ ] T021 [US2] Update UI render in `src/ui.html` to show corner radius mismatch message and allow applying nearest vs skip for that row (consistent with existing row-apply pattern).
- [ ] T022 [US2] Add apply logic branch in `src/apply.ts` to accept “use nearest” path for corner radius when provided by UI action; respect tolerance default.
- [ ] T023 [US2] Log skipped/nearest outcomes in status payload so the results panel communicates resolution choice.

**Checkpoint**: Mismatch handling flow exposes suggestions and actions; actions mutate only radii.

---

## Phase 5: User Story 3 - Token Scope Controls (Priority: P3)

**Goal**: Limit corner-radius tokenization to chosen scope (selection/page/document) consistent with existing spacing apply behavior.

**Independent Test**: Toggle scope to “selection only” and run apply; verify only selected nodes change; repeat for “current page”.

### Implementation for User Story 3

- [ ] T030 [US3] Confirm existing scope control UX; if missing, add scope selector covering selection/current page/document in relevant UI (likely existing controls) and ensure corner-radius path respects it in `src/code.ts`/`src/apply.ts`.
- [ ] T031 [US3] Ensure `scanSelection`/`applyAllMissing` honor scope for corner radius tokenization without affecting fills/strokes when not requested.

**Checkpoint**: Scope setting constrains corner-radius apply operations.

---

## Phase N: Polish & Cross-Cutting Concerns

- [ ] T900 [P] Update user-facing copy/help in UI for corner radius apply, including tooltip or note about tolerance reuse, in `src/ui.html`.
- [ ] T901 [P] Manual validation pass: run plugin on mixed selection (uniform, per-corner, zero) and confirm status messages for applied/skipped/nearest.
- [ ] T902 [P] Documentation: note corner radius tokenization behavior in README or internal docs if applicable.

---

## Dependencies & Execution Order

- Foundational scan/type updates (T002–T003) must precede apply/UI tasks.
- UI/button wiring (T013–T014) depends on apply helper (T011) and resolver reuse (T010).
- Mismatch handling (T020–T023) depends on base apply flow (T010–T015).
- Scope controls (T030–T031) depend on applyAllMissing integration (T012) and selection scan respecting scope.
