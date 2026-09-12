---
# practice-timer-lc1j
title: Add About modal, sidebar footer, and Privacy & Data Deletion guidance
status: completed
type: feature
priority: normal
created_at: 2026-09-12T17:06:48Z
updated_at: 2026-09-12T17:18:11Z
---

Add About modal accessible from sidebar and Settings, linking to practice-lab.net and catherina.dev, with privacy disclosures, GDPR/CCPA data deletion contact procedure, and data export capability.

## Summary of Changes
- Created AboutContext and AboutModal with three tabs: About, Privacy & Rights, and Backup & Export.
- About tab connects Practice Mate to the Practice Lab suite (https://practice-lab.net) and creator portfolio (https://catherina.dev), with feedback link via Microsaurus.
- Privacy & Rights tab details local-first storage vs Supabase cloud sync vs public report snapshots, with explicit GDPR/CCPA data deletion instructions directing users to contact via Microsaurus with their registered email.
- Backup & Export tab and exportAllPracticeData utility allow users to export all local practice routines, logs, and settings to a JSON file.
- Added sidebar footer in NavigationLayout with 'About Practice Mate' and 'Practice Lab Suite' external link, supporting both expanded and collapsed rail views.
- Updated Settings page with About & Privacy card (About, Privacy, Export JSON) in General tab and Data Deletion & Privacy Rights guidance in Account tab.
- Added comprehensive unit tests and verified with tsc, vitest, and vite build.

- Updated contact channels for feedback and GDPR/CCPA data deletion to hello@catherina.dev with pre-filled mailto templates.

- Added contactObfuscation utility to prevent email harvesting bots and crawlers from scraping the email. Replaced static mailto links with dynamic user-action-driven handlers, obfuscated display text, and copy-to-clipboard functionality.

- Refined Privacy tab: removed decorative icons/emojis from informational cards (Local-First, Cloud Sync, Public Reports) while keeping functional action icons on the Data Deletion card.

- Replaced raw email display text with an action-first UI (Email Deletion Request + Copy Contact Email) in both AboutModal and Settings to eliminate bot-scraped email text while ensuring a smooth user experience.

- Removed version number badge from AboutModal header and Settings About card.
