# PING: project process and AI-use handoff

**Prepared October 18, 2026.** This document is intended to be pasted into the separate chat that contains the original brainstorming process. It records what the implementation history actually establishes, so the brainstorming and build phases can be combined without inventing missing steps.

## How to use this with the brainstorming chat

Treat this as the implementation-side record. Combine it with the original ideas, alternatives, personal motivation and exact early prompts already in that chat. Preserve the distinction between what I decided, what AI proposed, what was implemented, and what was verified.

The current implementation agent could read the project files and the conversation that supplied the shared-tablet plan. It did **not** have the complete separate brainstorming conversation or the complete original challenge rubric. The repository describes the project as the **DALI Fullstack Challenge 26F**, and I said the application asks for process documentation. Exact rubric language, the full original brainstorming sequence and my personal reasons beyond the recorded design constraints should come from that other chat or from me.

The first-person project summary below is a draft for me to review. It is based on documented goals and decisions, not on invented interviews, personal experiences or field research.

## Project summary in my voice

I built PING to explore how people who have been separated can ask for contact without requiring the other person to reveal where they are or even respond. The idea is a private contact-request system supported by participating help desks. A person can ask a volunteer to submit a short message and some identifying clues. Staff at another desk can compare those clues with their own local residents and route a possible match. The recipient then decides whether to reply, decline, report a wrong-person match or separately share a shelter.

I wanted the workflow to account for people who might not have access to their usual phone, email or private computer. That is why the prototype uses an account code and a resident-chosen PIN, supports shared devices, and lets people ask for volunteer help checking replies. I also wanted those choices to stay independent: using a shared tablet does not automatically mean someone needs assistance, and having a personal device does not mean they do not.

Privacy affected the basic product design rather than being added as a final setting. A possible match is not verified identity. A requester's concern does not authorize disclosure. A help-desk affiliation does not establish where someone is staying. A reply does not imply permission to share a shelter. Those distinctions shaped the screens, the API projections and the tests.

I kept the prototype narrow. It is not a public people map, an automated identity matcher, a full chat service or an emergency-response platform. It demonstrates one private request, one approved reply, optional separate shelter sharing, staff assistance and restricted handling of sensitive cases. All examples are fictional.

I used AI extensively during development, including planning, implementation, tests, debugging, interface revisions, code review and documentation. The application itself does not use an AI model to match people or decide what information can be released. My role was to supply and refine the product goals, constraints and direction, approve the implementation plan, request a simpler shared-tablet experience, and decide when the concrete result is ready to publish.

## 1. From concept to a bounded product

The earliest planning available in the repository is the approved implementation plan dated October 16. It records a fictional-data prototype with a React/Vite browser, an Express API, TypeScript, PostgreSQL, Zod validation, Drizzle SQL migrations and a Leaflet help-desk map. The original in-chat brief is referenced in those files but is not reproduced in full here.

The core scope was a shelter-to-shelter contact cycle with explicit consent. A requester at one desk submits a request. Staff at a second desk review limited clues and choose a possible local candidate. That resident receives a private ping and personally approves any response. The requester sees only an acknowledgment, a waiting state or an approved response; they do not see matching progress, reading activity or private refusal decisions.

The plan explicitly constrained sensitive situations. Children, unknown ages and recorded consent concerns cannot use ordinary delivery or disclosure. A claimed family relationship or matching clue cannot override that restriction. Safeguarding was kept as a restricted referral/acknowledgment example, with real safeguarding decisions outside the prototype.

The important product decisions were therefore about boundaries as much as features: who can see a record, which information is projected to a requester, how consent is captured, what happens when a match is wrong, and what a shared device must forget.

## 2. Why the implementation took this shape

These are the reasons supported by the plans, code and decision logs:

- **Code/PIN login:** supports a fictional resident who cannot rely on email, a phone number or government ID. It also creates a recovery problem, which the prototype deliberately does not pretend to solve automatically.
- **Manual local matching:** makes uncertainty visible and limits profile access. It costs volunteer time and does not prove identity.
- **One reply:** keeps the initial communication task understandable and avoids claiming to implement a complete moderated chat system.
- **Exact preview before sending:** gives the recipient a concrete review step. The server signs the approved content rather than trusting a mutable browser summary.
- **Separate shelter consent:** protects the difference between being willing to reply and being willing to disclose a location. Shelter information remains self-reported.
- **Two independent login questions:** separates device privacy from the need for help checking replies.
- **Temporary assistance claims:** lets a volunteer deliver a specific message without silently acquiring permanent case/card access.
- **Same-origin browser/API:** makes the application boundary easier to inspect and keeps session/cookie/CSRF behavior in one origin.
- **Real PostgreSQL:** permits meaningful checks of persistence, relational constraints, transactions, concurrent claims and duplicate retries.
- **Memory-only drafts:** preserves unfinished work during ordinary in-app navigation while clearing it on logout, expiry or account changes. A full page reload also clears drafts.
- **An independent text directory:** keeps desk information available when external map tiles fail.

These choices were not established by user interviews or disaster deployment. They are documented engineering/product decisions for a constrained challenge prototype.

## 3. Initial implementation and review — October 16

The repository's earlier logs describe a complete local frontend/backend/database implementation. The local environment used a project-local native PostgreSQL server while managed hosting access was pending. That meant database behavior could be tested without claiming a live public deployment.

The recorded initial build included resident registration, code-only account cards, code/PIN authentication, per-session device settings, persistent assistance preferences, manual matching, private delivery, signed reply/location previews, silent decline, wrong-person exclusion, safeguarding restrictions, help desks and isolated fictional reviewer workspaces.

The historical verification document reports **14 API tests and seven Chromium scenarios passing** after review fixes. It also records several useful examples of AI-assisted debugging:

- A duplicate-name test exposed that the demo guide could confuse a newly registered resident with a seeded fictional identity. An explicit fixture key replaced name-based identification.
- Browser checks exposed label/help-text and reusable selector accessibility issues; explicit associations were added.
- Review found that a delayed session-store save could recreate a session after logout. Durable revoked-session records were added so the old cookie still could not authenticate.
- Assistance originally needed to cover approved replies to the requester as well as incoming pings. Queueing and later shelter-update behavior were extended.
- A successful registration followed by a failed account-card fetch could strand the user or encourage duplicate registration. The app retained the created account and added card recovery.
- Unused migration-generation tooling brought unnecessary dependency findings; it was removed while checked-in Drizzle-run SQL migrations remained.

These are historical observations from the project records. The later implementation pass reran the baseline rather than treating the old results as current proof.

## 4. Shared-tablet simplification — October 18

The next supplied plan was titled **“PING: verify first, simplify for a shared tablet.”** It said to replace the promotional landing page with one task-focused home across tablets, phones and computers, preserve existing permissions/features, and avoid an organization-admin system or new communication features.

The brief emphasized verification before visual redesign. It identified two backend issues: successful staff sign-ins counted toward an account throttle, and claiming a reply-assistance task could grant permanent case access. It also identified interface friction: error screens that kept saying Loading, drafts lost on refresh or section changes, incomplete ARIA tabs, a composer shown too early and crowded staff navigation.

The implementation took place in `Projects/ping-tablet`, a separate copy of the untracked original `Projects/ping`. This preserved the earlier source instead of overwriting it or creating a worktree that would not contain untracked application files. Local dependencies were shared through a node_modules junction; secrets stayed in an ignored environment file.

Before changes, the agent reran the **14 API tests and seven browser scenarios**. Windows sandbox restrictions blocked native bundler/browser helper operations on the first attempt; the same commands succeeded with elevated tool access. These were environment failures, not evidence that the application was broken.

New API regressions first reproduced both identified defects. The staff login test hit 429 after repeated valid sign-ins. A fresh staff account with no pre-existing case grant could claim reply assistance and then read an account card. The fixes reset only a successful staff account's throttle and removed only the claim-time grant, preserving failed-login/IP protections and explicit case access.

The resulting interface has three home actions: **Check my pings**, **Request help finding someone**, and **Find a help desk**. Resident sections are **Messages for me** and **Requests I've made**. Reply opens the composer; an exact preview precedes Send; confirmation offers **Done—sign out**. Later shelter sharing is behind **Share a shelter (optional)**. Staff tasks use a vertical rail on wide screens and a wrapping grid on narrow screens. Existing case requests appear before the expandable new-request form. The help-desk list comes before the map on narrow screens.

Data loading now distinguishes initial loading, refresh, error and empty states. Failed loads offer Retry. Editors remain mounted in memory across in-app refresh and section changes. Account changes invalidate in-flight responses and reset private state. The inactivity warning uses a keyboard-operable dialog and explains failed renewal without pretending the deadline moved.

A fresh read-only AI reviewer found two additional issues: focus could be lost after canceling a private decision or returning from a shelter preview, and retained cases could keep an outdated assistance preference. Both were reproduced with browser regressions and fixed. Testing also added a sign-out pending screen so private content disappears immediately while the normal UI waits for the server attempt before handoff.

That phase finished with **19 API tests, 22 Chromium scenarios and the build passing**, fresh screenshots and a working loopback-only preview. Those totals describe that checkpoint, not the expanded pass below.

## 5. Broader feature testing and documentation pass

After reviewing the implementation summary, I asked the agent to test the other features, review the whole project, fully explain the project in the README and prepare a process document that I could combine with my brainstorming chat. I said I would come back to publish it, so this pass did not publish, push or purchase hosting.

The added feature checks exercise staff-created contact requests all the way through another desk to the recipient, incoming assistance claim/release/presentation, approved-reply assistance and preference revocation, safeguarding acknowledgments, failed staff-feed retries, and cross-tab sign-out/login. Additional API tests cover tampered and expired previews, wrong-action/resident tokens, one-time shelter disclosure, assigned safeguarding acknowledgment boundaries and sessions surviving application recreation against the same database. Application recreation is not the same as a physical database restart or a deployed-host restart test.

A second whole-project AI review found two more functional defects that were reproduced before fixes:

1. **A newly shared shelter could be missed by an open assistance claim.** A volunteer could have fetched the earlier text, then mark it presented before the five-second poll noticed the new location. The task now requeues and invalidates an open claim when separately approved disclosure changes, forcing a fresh claim/read.
2. **A locked tab retained an old CSRF token after another tab rotated the session cookie.** Its normal login form could fail until a reload. Cross-tab locking now refreshes public session metadata without restoring the private screen, including a notification after logout rotation completes.

The reviewer also identified a real limit in safeguarding: the restricted projection lacked enough information to connect a referral to a person or external intake record. The UI now displays its existing referral UUID so entries can be distinguished, without broadening the API or adding cross-shelter profile access. Identity/intake linkage remains an explicitly documented limitation of the prototype. It is not described as fixed end-to-end or production-ready.

This expanded pass finished on October 18 with **24 API tests and 28 Chromium scenarios passing**, a passing TypeScript/production build, and **zero known dependency vulnerabilities reported by `npm audit`**. This is local automated evidence, not a security certification. Actual shared-tablet hardware, screen readers, other browser engines and the public host remain unverified.

The detailed results and remaining unverified environments are recorded in **`docs/verification.md`**. That file is the evidence source to use when preparing the final submission; do not copy a historical count and label it current.

## 6. What I used AI for

| Stage | AI contribution | My role / boundary |
|---|---|---|
| Product planning | Helped structure the architecture, implementation order and tradeoffs | Supplied and refined goals, privacy constraints, scope and accepted direction |
| Implementation | Wrote frontend, API, schema/seed, validation, session and workflow code | Requested the working application and preserved control over publication |
| Testing | Wrote API and browser checks; ran them against real local PostgreSQL and Chromium | Requested verification rather than assuming the generated application worked |
| Debugging | Used failing checks to identify defects, implement fixes and rerun checks | Asked for reliability, shared-device behavior and preservation of existing boundaries |
| Interface iteration | Replaced the promotional home and simplified existing flows | Selected a simple task-focused home for tablets, phones and computers |
| Review | Separate AI reviewer contexts examined code and returned findings | Requested broad review before returning to publish; AI review is not human certification |
| Documentation | Expanded README, decision/verification notes and this handoff | Asked for a detailed explanation and transparent process/AI-use account |
| Research context | Earlier plan referenced humanitarian services and GOV.UK interaction patterns | No claim that PING copied or validated a live service workflow; current REFUNITE mobile UI was not inspected |

AI was not used inside the running product to classify residents, search a real population, infer identities, verify a shelter location or authorize reunification. No real personal data, field interviews or emergency deployment were part of these tests.

## 7. How I prompted the agent

The most useful pattern in the visible record is that the prompts included constraints and observable outcomes, not just a broad request to build an app. They specified privacy boundaries, retained features, known defects, intended screen behavior and tests that would demonstrate success.

### Exact excerpts available in this conversation

The implementation handoff explicitly instructed:

> “Implement the plan in a fresh context. Treat the plan as the source of user intent, re-read files as needed, and carry the work through implementation and verification.”

The supplied plan established the interface direction:

> “Replace the landing page with one simple, task-focused home on tablets, phones, and computers, as you selected. Keep existing features and permissions; no organization-admin system or new communication features.”

It made reliability and consent concrete:

> “Remove automatic permanent case grants when staff claim an assistance task. Task access remains lease-bound; explicit, audited local-case access remains a separate existing permission. Preserve legitimate existing case grants.”

> “Retain drafts in memory across ordinary refresh and section changes. Clear all private state on logout, expiry, or account change. Never persist drafts on shared devices.”

> “After sending, show confirmation and Done—sign out. Put further shelter disclosure behind Share a shelter (optional).”

My later spoken request included these excerpts from the transcript:

> “go ahead and test uh the other features, review everything”

> “Try to make the readme as detailed as possible and explain what the app is, what it does, its purpose, and why I chose to do it the way I did.”

> “make a summary of the process so far. Things that I use AI for, how I prompted you and stuff like that so I can put it into a chat that I have.”

These are available excerpts, not a complete prompt history. The earlier brainstorming chat should supply the original idea exploration, alternatives and exact original build prompt. Do not turn the retrospective descriptions in this document into fabricated quotations.

### What the prompting achieved

The scoped plan prevented the redesign from becoming a new product. The explicit privacy constraints made it possible to test what must remain hidden, not just whether buttons worked. Asking for a fresh context and rereading files encouraged the agent to verify the actual implementation instead of trusting a previous summary. Asking for baseline tests distinguished older evidence from new results. Requesting broad review after the initial completion found ordering and cross-tab problems that the initial happy-path walkthrough did not expose.

## 8. What I would carry into the final reflection

The project shows that a privacy-oriented interface depends on backend rules, not only on reassuring copy. “No shelter shared” needs a response serializer that actually omits it. “Sign out” needs revoked-session handling and a cleared private screen. “Retry” needs an operation identity so a committed write is not duplicated. “Volunteer help” needs authorization that ends when the task ends.

It also shows why generated code still needs testing and review. Passing initial tests did not mean all feature combinations were correct. Later regressions found successful-login throttling, permanent access hidden by seeded permissions, draft loss, keyboard focus loss, stale preferences, an assistance content-update race and cross-tab CSRF state. Some initial failures were test assumptions or environment issues rather than product defects; those were corrected and not counted as application fixes.

The strongest evidence of progress is the working private contact cycle, the explicit restrictions and the repeatable test coverage. The weakest claims would be that the app verifies identity, solves real safeguarding, works offline, scales to disaster demand or has been validated by users. None of those claims is supported here.

## 9. Review and submission handoff

- Review the current local preview and the README/process wording, especially the first-person rationale.
- Merge this implementation record with the original brainstorming chat and the actual application rubric.
- Decide how to handle the known safeguarding intake-linkage gap before any operational use; the current panel is a limited fictional acknowledgment demonstration.
- Test actual shared tablets/iPad keyboard behavior, screen readers, Safari/Firefox and printing if those claims matter to the submission.
- Use the verified repository and live-demo links from the release addendum below. Keep host-specific checks and limitations in the final submission rather than treating local tests as evidence for every environment.

The earlier stages above describe the pre-publication record. The release addendum below records the later publication; no paid hosting purchase, field study, formal security certification or production-readiness claim is part of the project.

## 10. Release addendum — October 18

After returning, I asked the agent to proceed and signed in to Render and Neon. The agent prepared the exact publication package and free-tier deployment settings, and asked for explicit approval to publish the files and store the database connection in Render. The source was published at [DavidG214/ping](https://github.com/DavidG214/ping); the fictional app is available at [ping-davidg214.onrender.com](https://ping-davidg214.onrender.com).

This final stage found issues that earlier passing tests had not exposed. Restarting local development revealed that the database helper always ran initialization instead of reusing an existing cluster; checking for `PG_VERSION` fixed repeat starts. The first Linux CI run then exposed a demo-login form remount during background session renewal. A controlled delayed-response regression reproduced it, and subscribing to React Router's location fixed the stale route key. A cross-tab timing test also showed that refreshing session metadata before logout completed could race cookie rotation. The agent separated immediate privacy locking from the post-rotation session refresh. It corrected a registration test that navigated away before staff logout finished.

The resulting release CI passed **24 API tests, 29 Chromium scenarios and the production build**. The agent separately tested the deployed API's exact reply/location consent, duplicate retry handling, demo isolation and secure logout, and completed the Staff B → Jordan → Alex flow in the public browser. A Render service restart preserved the same personal-device session, approved reply and separately shared shelter. These are observed release checks, not a claim of field readiness. Outstanding device/accessibility checks and the distinction between a web-service restart and database disaster recovery are recorded in `docs/verification.md`.

## Evidence files

- `README.md`: project purpose, feature behavior, design rationale, architecture, setup and limits.
- `docs/implementation-plan.md`: recorded October 16 plan and fixed decisions.
- `docs/decisions.md`: implementation choices and earlier review fixes.
- `docs/tablet-implementation.md`: the October 18 simplification ledger and its rulings.
- `docs/verification.md`: dated checks, results, failure/fix evidence and unverified boundaries.
- `docs/ai-use.md`: short AI-use timeline.
- `docs/api.md` and `docs/staff-process.md`: access and restricted-process boundaries.
- `tests/api.test.ts` and `tests/browser/`: executable checks behind the verification claims.
- `docs/screenshots/`: captures from the actual local application, not design mockups.
