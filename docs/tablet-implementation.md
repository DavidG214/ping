# PING shared-tablet implementation ledger

Source: user-supplied plan, October 18, 2026.

Working copy: `C:/Users/guerr/Projects/ping-tablet`. The original untracked project in `../ping` is preserved. Dependencies are shared through a local node_modules junction; configuration was copied locally and remains ignored.

Ruling: use a separate copy rather than a worktree because all application files are untracked and would be absent from a worktree. No commits or publication before preview review.

Ruling: ordinary refresh means in-app data refresh. A full browser reload clears memory-only drafts, as required for shared-device privacy. Section changes retain drafts; logout, expiry and account changes discard them.

Pre-flight: API response contracts remain unchanged. Keep task authorization lease-bound, and explicit case access separate. UI changes depend on stable refresh state, so address data loading before restructuring screens.

Tasks:
1. Baseline and privacy/login regressions.
2. Load/refresh/session state and draft retention.
3. Task-focused home, resident flow, staff navigation and directory.
4. Browser regressions, screenshots, fresh review and verification report.

Baseline: 14 API tests and 7 Chromium scenarios passed. Sandbox blocked native bundler and browser server startup; the same build and browser commands passed with elevated tool access.

Design: retain PING's blue (#245ddf), ink (#152b46), muted text (#58677b), pale background (#f7f9fc), white and light borders (#dce4ee). System sans-serif body and restrained Trebuchet headings. The home is a compact three-action help-desk menu; no decorative hero or promotional footer.

Task 1: complete. New tests first reproduced successful staff login returning 429 and fresh assistance claimants gaining account-card access. Fixes clear only the successful staff account throttle and remove only claim-time case grants. 19 API tests passed, including all four claim endings (release, presented, lease expiry, opt-out), competing staff, alternate case/card/request endpoints, existing explicit grants, failed-login/IP throttles, and earlier privacy cases. The concurrent route test now always exercises assistance assertions with both candidates eligible; Sam also has a seeded task, so it asserts two tasks rather than conditionally skipping.

Task 2: complete. Loading/error/empty/refresh states are separate and retryable. Refresh retains last data and mounted editors. Session revalidation covers rather than destroys the current screen. Account transitions invalidate in-flight responses and reset the private component tree. A sign-out curtain hides private content immediately and prevents normal UI handoff until the server attempt settles. Offline logout retains the existing lock marker.

Task 3: complete. Three home actions, compact navigation/login, resident section buttons, explicit reply composer and send confirmation, optional shelter disclosure, staff rail/grid, retained case/request forms, list-first help desks, and keyboard-operable modal inactivity warning. Safeguarding permissions and separate workflow are unchanged.

Review: one fresh-context read-only reviewer found lost focus on Cancel/shelter editing and stale assistance metadata in retained cases. Both received failing browser regressions and fixes. No second independent review is claimed. Additional browser testing found a sign-out navigation timing issue; the handoff curtain and response-aware test fix it for normal UI navigation. Forced browser navigation during a pending logout can interrupt the request; the existing lock marker requires revocation on reconnect and may lose the fictional demo session, but does not expose private data.

Task 4: complete. Final build passed; 19 API tests and 22 Chromium scenarios passed. Fresh screenshots cover desktop, 320px phone, tablet portrait/landscape, resident preview/confirmation, staff navigation and failed-map directory. A separate Chromium smoke check against the running localhost:41938 preview observed a healthy API, three desks and no page errors. Details and remaining limits are in `docs/verification.md`. No migration, commit, push, deployment, real-tablet test or screen-reader test was performed.
