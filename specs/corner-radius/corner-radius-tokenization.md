# Feature Specification: Corner Radius Tokenization for "Apply Token to All"

**Created**: 2025-12-09  
**Status**: Draft  
**Input**: User description: "Tokenisation for 'Corner radius'. This comes under the 'spacings' checkbox when we do 'Apply Token to All'."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Apply to Selected Nodes (Priority: P1)

As a designer, I can run "Apply Token to All" with the Spacings checkbox selected and have corner radii on all selected nodes mapped to existing spacing tokens so the file uses consistent tokenized radii, and I can also fix a single node via an in-row "Apply Corner Radius Token" button (mirroring the existing padding action button).

**Why this priority**: Ensures the bulk action immediately enforces design token consistency for rounded corners across the current selection, which is the primary value of the feature.

**Independent Test**: Select a mixed set of nodes with varying corner radii, run "Apply Token to All" with Spacings checked, and verify all applicable radii are replaced with the correct tokens without touching unrelated properties.

**Acceptance Scenarios**:

1. **Given** a selection containing frames, buttons, and icons with differing corner radii, **When** I run "Apply Token to All" with Spacings checked, **Then** each node's corner radius is replaced with the closest matching spacing token and the applied token name is logged in the results panel.
2. **Given** a node whose radius exactly matches a spacing token value, **When** I apply tokens, **Then** the node is updated to reference that token without altering its numeric radius.
3. **Given** a node flagged as missing a radius token in the results list, **When** I click the single action button "Apply Corner Radius Token", **Then** it binds the matching spacing token (or nearest within tolerance) without affecting other properties—exactly as the padding button does.

---

### User Story 2 - Review & Mismatch Handling (Priority: P2)

As a designer, I can see which nodes could not be matched to a spacing token and choose an action (skip, use nearest, or create placeholder) so I can resolve corner radius mismatches confidently.

**Why this priority**: Provides transparency and control, reducing accidental visual regressions when auto-mapping imperfect values.

**Independent Test**: Run the bulk action on nodes with corner radii not present in tokens and confirm the UI surfaces a mismatch list with per-item actions that update the node accordingly.

**Acceptance Scenarios**:

1. **Given** nodes with corner radii that do not match any spacing token, **When** I apply tokens, **Then** the results panel lists each mismatch with suggested nearest tokens and allows me to apply the nearest, skip, or mark for later.

---

### User Story 3 - Token Scope Controls (Priority: P3)

As a designer, I can limit corner radius tokenization to a scope (e.g., current page, selection only) so I avoid unintended changes in large files.

**Why this priority**: Reduces risk when working in large documents by scoping the automation.

**Independent Test**: Run the feature with "selection only" enabled and verify only selected nodes change; rerun with "current page" and verify only that page is affected.

**Acceptance Scenarios**:

1. **Given** the scope is set to "selection only", **When** I apply tokens, **Then** only the selected nodes have their corner radii tokenized and other nodes remain unchanged.

---

### Edge Cases

- What happens when a node has mixed corner radii (per-corner values) instead of a uniform radius?
- How does the system handle nodes whose corner radius is zero or unset?
- What happens when the nearest token is beyond an allowed tolerance (e.g., >2px difference)?
- How does the system handle fractional radii (e.g., 3.5) when tokens are integers?
- What happens if a required spacing token is missing, deprecated, or locked?
- How does the system behave on components/instances with overridden corner radii versus main components?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST include corner radius in the Spacings checkbox flow for "Apply Token to All".
- **FR-002**: System MUST map uniform corner radii to existing spacing tokens using the same matching logic/tolerance as padding tokenization.
- **FR-003**: System MUST detect and list nodes whose corner radii cannot be matched, with options: apply nearest token, skip, or flag for later.
- **FR-004**: System MUST support scope selection (e.g., selection, current page, document) and limit changes accordingly.
- **FR-005**: System MUST handle mixed/per-corner radii by either tokenizing per-corner when supported or flagging as unsupported with guidance.
- **FR-006**: System MUST present a summary of applied tokens and skipped items in the results/log panel after execution.
- **FR-007**: System SHOULD reuse existing spacing token definitions and MUST NOT create new tokens automatically without explicit user action.
- **FR-008**: System SHOULD allow configuring tolerance for nearest-match suggestions; default tolerance MUST align with padding tokenization rules.
- **FR-009**: System MUST respect component/instance overrides, only changing radii where allowed by Figma APIs.
- **FR-010**: System MUST avoid changing non-radius properties when Spacings is selected solely for corner radius tokenization.
- **FR-011**: UI MUST surface a single in-row action button labeled "Apply Corner Radius Token" (paralleling the padding button in `src/ui.html`) when a node is missing a corner-radius token; clicking it MUST trigger the apply flow using the same spacing-variable resolver used for padding.

### Key Entities *(include if feature involves data)*

- **CornerRadiusToken**: Represents a spacing token that can be applied to node corner radii; attributes: name, value, unit, status (active/deprecated), scope.
- **NodeSelection**: Represents the set of nodes in scope for tokenization, including metadata on node type, current radius values, and component/instance status.
- **MismatchItem**: Represents a node whose radius could not be matched; attributes: node id, current radius, suggested nearest token(s), user-selected resolution.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of nodes with uniform corner radii in scope map to an existing spacing token without manual intervention.
- **SC-002**: Bulk application completes on a selection of 200 nodes within 3 seconds on a standard design file.
- **SC-003**: 0 unintended changes to non-radius properties when running with Spacings selected for corner radius tokenization (validated via audit log).
- **SC-004**: 90% of users report confidence (via post-action prompt) that mismatch handling is clear and actionable.
