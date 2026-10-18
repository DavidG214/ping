# Decision log

## 2026-10-16

- Approved architecture: explicit React/Express boundary, one origin, PostgreSQL persistence.
- Fresh repository on `build/ping` in the approved new folder; no existing worktree or unrelated files modified.
- Ruling: use project-local embedded native PostgreSQL for development/testing while Neon credentials are pending. It runs the actual PostgreSQL server bound to loopback; deployed storage still requires managed PostgreSQL. No global database installation or Windows service.
- Ruling: preserve the execution ledger in tracked documentation rather than ephemeral skill scratch files, so review evidence survives handoff. Sequential execution; a final independent review follows the execution skill.
- Design: PING is a calm civic help desk. Paper-white (#F7F9FC), midnight blue (#152B46), signal blue (#245DDF), soft sky (#EAF1FF), muted slate (#58677B). System sans body and rounded Trebuchet display. Signature: a folded contact card with a small signal-ring mark; no disaster imagery or live-person map pins.

## Progress

Planning approved; local implementation built. No deployment yet.

- Tasks 1–6 implemented locally; initial live deployment was deferred because Render/Neon credentials are not yet supplied. The database path was proven with actual local PostgreSQL instead.
- SQL is parameterized through node-postgres; Drizzle runs committed SQL migrations. Removed unused drizzle-kit after audit showed four moderate transitive development findings. This reduces dependencies without changing the schema or migration contract.
- Added an explicit `demo_key` fixture marker after a duplicate-name test exposed a name-based guide lookup flaw.
- Form accessibility uses explicit labels and help-text descriptions, including forwarded props on reusable selectors.
- Use only system font fallbacks, so private screens do not contact a font provider.
- Ruling: focused security inspection is part of the final independent code review plus negative API tests; no formal Codex Security scan report or production certification is claimed. The broad repository-scan skill's orchestration is unnecessary for this small newly authored change.
- Browser tests use dedicated PostgreSQL `ping_test` and port 41937, isolated from the interactive development workspace. They intentionally clear only that test database.
- Final local verification: 14 API tests and seven Chromium scenarios passed after review fixes; production build passed; dependency audit zero findings.
- Review fix: durable session revocation prevents delayed session saves from restoring logged-out access. Revocation records expire after nine hours, beyond the maximum session lifetime; expired records are cleaned during demo creation.
- Review fix: assistance covers both incoming requests and approved replies. Later explicit shelter consent reopens only that reply's completed task. Disabling assistance immediately cancels active server claims; already-read information cannot be recalled.
- Review ruling: elevated the reviewer's minor card-fetch issue to important because a lost credential card can strand a resident or cause duplicate registration. Preserve the created ID and allow scoped card retry from Local cases.
- Kept the new branch and local files for David's concrete publication review; no merge, public push or hosting purchase performed. The branch-finishing menu is not applicable to this initial repository with no base commit and a pending external release.

## October 18 expanded feature review

- Preserve the separate `ping-tablet` implementation and the original `ping` source. David will return for publication; no commit/push/deployment in this pass.
- Requeue and invalidate a claimed reply-assistance task when separately consented shelter content changes. A volunteer must fetch current approved content before marking it presented; no schema or API contract change is required.
- Refresh only public session metadata after a cross-tab privacy lock. Never adopt the other tab's actor or reopen its private screen automatically. Notify receiving tabs again after logout rotates the cookie.
- Surface the existing safeguarding reference UUID, preserving the restricted API projection. The lack of identity/intake linkage remains a known operational limitation. Do not describe reference visibility as a complete safeguarding case-management fix.
- Expand documentation from actual code, test evidence and existing logs. Quote only prompt text available in this conversation. Use the separate brainstorming chat to fill early motivation and rubric gaps rather than inventing history.
