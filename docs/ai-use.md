# How AI was used in PING

**Updated October 18, 2026.** The longer [project reflection](process-handoff.md) explains the decisions and development process in David's voice. This log summarizes the contributions and recorded checkpoints.

## David's direction

David supplied and refined PING's purpose, privacy priorities, access constraints, and scope. He kept the project focused on a private contact request in which the recipient controls the response and any shelter disclosure. He chose a simpler task-focused interface for shared tablets, phones, and computers, and asked for broader feature testing and whole-project review before publication.

His strongest contribution was carrying those priorities through the project. Privacy shaped the workflow; shared-device use shaped the interface; testing shaped the release standard. He also asked for documentation that explained the reasoning and made AI's contribution clear. After returning for release, he signed in to the hosting services and authorized the prepared publication.

## Codex's contribution

Codex proposed the approved architecture and implementation order, wrote substantial application and test code, created fictional fixtures, debugged failures, revised the interface, drafted documentation, and configured and checked the deployment. Separate AI reviewer contexts examined implementation details and reported findings. These were AI reviews, not independent human certification.

The tests and technical investigations below were performed by Codex. David's role was directing the work, making product decisions, requesting deeper verification, and authorizing release; this record does not attribute AI-written code or AI-run checks to him as manual work.

AI is used in development, not inside PING to identify residents, match people, or authorize disclosures. No real personal records, user interviews, or field research were used in the demonstration.

## Development checkpoints

| Stage | Direction and work | Recorded result |
|---|---|---|
| October 16: planning and initial build | David approved the plan. Codex implemented frontend/backend/database flows and reviewed privacy and failure cases. | Build, 14 API tests, and seven Chromium scenarios passed after fixes to demo identity, accessibility, logout handling, requester assistance, and account-card recovery. |
| October 18: shared-tablet revision | David selected the simpler home and retained the existing feature/permission scope. Codex reproduced login-throttle and assistance-grant defects, fixed them, revised the screens, and addressed further AI review findings. | Build, 19 API tests, and 22 Chromium scenarios passed; screenshots captured. |
| October 18: broader review | David requested testing of the other features, whole-project review, a detailed README, and a process summary. Codex expanded coverage and fixed assistance-update ordering and cross-tab session issues. | Build, 24 API tests, and 28 Chromium scenarios passed locally. Local dependency audit reported zero known vulnerabilities. The safeguarding intake-linkage limitation remained documented. |
| October 18: publication | David returned, signed in to Render and Neon, and authorized publication. Codex published the source, configured free hosting, and fixed timing issues exposed during release checks. | Final Linux CI passed the build, 24 API tests, and 29 Chromium scenarios. Public API and Chrome walkthrough checks passed. A Render service restart retained the checked session and approved reply/shelter data. |

These are dated checkpoints, not cumulative test totals. [Verification evidence](verification.md) records the failures, fixes, release links, and remaining limits.

After publication, David asked for a more natural process reflection that emphasized his contributions, an in-depth README with a simpler example, and repeated live Playwright checks. Codex removed the chat quotations, revised the attribution and walkthrough, and added an opt-in live suite. Its final run passed all four checks, including the complete reply/shelter example in fresh desktop and tablet-sized sessions. An initial automation timing error was corrected to wait for visible sign-out completion; no application change was needed.

## What the collaboration shows

David gave the agent a consistent product direction and kept refining what a successful result should look like. His requests connected features to constraints and asked for checks beyond the first happy path. That combination helped the project stay focused while uncovering problems that initial testing missed.

The [process reflection](process-handoff.md) paraphrases that prompting approach without reproducing casual chat transcripts. It draws from the available project record; the separate original brainstorming chat can add the earlier exploration and personal motivation.

PING remains a fictional educational prototype. Physical shared-tablet hardware, screen readers, other browser engines, disaster-scale demand, and real-world safeguarding have not been validated. Public deployment checks establish specific observed behavior, not production certification.

