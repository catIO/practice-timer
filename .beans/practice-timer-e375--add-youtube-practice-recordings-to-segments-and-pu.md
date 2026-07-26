---
# practice-timer-e375
title: Add YouTube practice recordings to segments and published reports
status: completed
type: feature
priority: normal
created_at: 2026-07-26T14:10:30Z
updated_at: 2026-07-26T14:13:12Z
---

Support adding YouTube practice recordings to practice segments in the practice plan and displaying them in both segment cards and published reports.

## Summary of Changes

- Added generic `videoUrl?: string` to `PracticePlanItem` and `ReportSnapshotItem`.
- Updated `practicePlanApi.updateSegment` and snapshot encoders to support video recording links.
- Updated `PracticePlanPane.tsx` segment edit mode to include a practice video link input.
- Rendered recording links in segment card view and published reports (`Report.tsx`) using `RichLink` so YouTube links render with YouTube icon/title pills and open in a new tab.
- Added unit tests for segment `videoUrl` updates and report snapshot serialization.
