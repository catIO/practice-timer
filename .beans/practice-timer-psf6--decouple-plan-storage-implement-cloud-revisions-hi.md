---
# practice-timer-psf6
title: Decouple plan storage, implement cloud revisions history, and refactor plan editor
status: todo
type: epic
priority: high
created_at: 2026-09-16T12:11:06Z
updated_at: 2026-09-16T12:11:06Z
---

## Objective
Harden Practice Mate for scale and multi-device SaaS reliability by separating practice and lesson storage domains, adding automatic cloud revisions ('Time Machine'), independent sync channels, and refactoring PlanEditorPane.

## Phases
- Phase 2: Database Domain Separation & Cloud Revisions
  - Create dedicated practice_plans, lesson_plans, and plan_revisions tables
  - Add Postgres trigger to automatically capture rolling 30-day revision history
  - Migrate user_practice_data rows
- Phase 3: Independent Sync & Version History UI
  - Split push/pull handlers in userDataSync into isolated channels
  - Add optimistic concurrency with version checks
  - Add 'Version History' drawer/modal in editor with 1-click restore
- Phase 4: Component Decoupling
  - Refactor PlanEditorPane into generic BlockEditor and specialized domain wrappers
