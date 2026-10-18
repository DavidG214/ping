# PING: how I built it and used AI

**October 18, 2026 · Project reflection and implementation record**

## The idea I kept coming back to

I built PING around a question that sounds simple until you think through the details: how can someone ask whether another person is safe while leaving that person in control of the answer?

The result is a fictional contact-request app for the DALI Fullstack Challenge 26F. Participating help desks can help someone submit a request, staff at another desk can review a possible match, and the recipient decides whether to respond. They can send a short reply, choose not to respond, report a wrong-person match, or separately share a shelter.

What I brought to this project was a clear sense of what the app needed to respect. Someone looking for you does not automatically get to know where you are. A similar name does not prove identity. Using a shared tablet does not mean you want a volunteer reading your messages. Those distinctions became actual requirements for the product.

I used AI extensively to turn that direction into a working application. It helped with planning, wrote substantial code and tests, debugged failures, reviewed the implementation, and drafted documentation. My contribution was setting the direction, refining the constraints, making product choices, and continuing to ask whether the result actually worked for the situation I had in mind.

## What I think I did well

### I thought about the person using it

I wanted the app to account for someone who might not have their usual phone, email account, or private computer. That changed the design from the beginning. The prototype uses an account code and a resident-chosen PIN, supports shared devices, and offers help checking replies.

I also kept device privacy and assistance as separate choices. A person with their own phone might still need help. A person on a shared tablet might want to check independently. Giving people both choices makes the workflow more respectful and avoids making a personal decision for them.

That is one of the stronger parts of the project: I kept asking what an assumption would mean for the person on the other side of the screen.

### I made privacy part of how the app works

I treated consent as something the workflow had to enforce. Replying and sharing a shelter are separate decisions. The recipient sees an exact preview before sending. Declining or reporting a wrong-person match does not tell the requester what happened privately.

These choices gave the implementation something concrete to follow and the tests something concrete to check. The standard was whether the app actually withheld information until the person approved it.

### I kept the project focused

There were plenty of ways this idea could have expanded: automated matching, a public people directory, a full messaging platform, notifications, or an administration system. I kept the work centered on a smaller contact cycle that could be implemented and examined properly.

That decision helped the project reach a working release. It also made the tradeoffs easier to explain. Manual matching takes staff time. One reply is limited. Code/PIN access has recovery challenges. I could acknowledge those limits while still demonstrating the core idea.

### I was willing to simplify something that was already built

After the initial implementation, I chose a simpler home for tablets, phones, and computers. The main actions became checking pings, requesting help, and finding a help desk. Promotional content gave way to the tasks people came to do.

I also asked for a clearer resident flow: read the message, choose Reply, review exactly what will be sent, send it, and have an obvious way to sign out. Optional shelter sharing comes after a deliberate choice. Those changes made the interface follow the privacy decisions more closely.

### I asked for more than a working-looking demo

Even after the initial build and testing, I asked for the other features to be checked and the whole project to be reviewed. That mattered. The broader work found problems in assistance updates and cross-tab sessions that a single successful walkthrough would not have caught. Release checks later exposed additional timing problems.

I did not personally discover or repair each of those bugs; AI performed that implementation and verification work. My contribution was asking for the deeper pass and making reliability part of the definition of finished.

### I followed through on the explanation and release

I wanted the README to explain what PING does, why it exists, and why it was built this way. I also asked for a separate account of how I used AI so I could connect the implementation to my earlier brainstorming process.

I returned for publication, signed in to the hosting services, and authorized the prepared release. The project now has a public repository and a live fictional demo. Taking it through documentation, review, and deployment made the result much easier for someone else to try and evaluate.

## How the main design choices fit together

The app starts with a request, not a guarantee of contact. Staff see limited clues and review possible local candidates. A match remains uncertain, and the recipient keeps control of any response.

The account-code/PIN model supports the access constraints I wanted to explore. It avoids depending on email or a phone number, but it does not solve account recovery. A name or birthday is not enough to recover someone's access in this demo.

The exact reply preview gives consent a specific object: this text, for this request, with this disclosure. The backend checks that approval. Shelter sharing requires its own choice and a statement of current presence; the app labels it as self-reported rather than verified location.

Assistance is similarly limited. A volunteer can claim a delivery task, but that claim should not quietly become permanent access to someone's account card or history. Task access expires or ends when released, completed, or canceled. Explicit local-case access remains a separate staff action.

The shared-device design balances continuity with privacy. Drafts stay in memory during in-app refreshes and section changes, so ordinary navigation does not throw away someone's work. Logout, expiry, account changes, and a full page reload clear them. Private drafts are not saved in browser storage.

The help-desk directory has a complete text list alongside the map. A failed external map tile should not stop someone from reading the available desk information. The map shows fictional help desks, never residents.

Children, unknown ages, and recorded consent concerns stay outside ordinary delivery and disclosure. The safeguarding panel demonstrates restricted referral acknowledgment. It does not implement a complete real-world safeguarding process.

## How I worked with AI

My approach was iterative. I supplied and refined the purpose and constraints, worked from an approved plan, reviewed the resulting direction, and asked for changes and broader verification. As the project became more concrete, the requests became more specific about behavior, scope, and evidence.

For example, the shared-tablet direction paired a simpler interface with explicit limits: preserve existing permissions, keep assistance access temporary, retain drafts only in memory, and make sign-out clear. That gave the agent a useful target and made it possible to check whether a redesign preserved the important behavior.

I also asked for the reasoning to be documented. That made the collaboration more useful to me: I could trace the decisions and explain the product, instead of ending up with only a running app and a pile of generated files.

The strongest part of my prompting was connecting the desired result to constraints and follow-up checks. I asked for the app to be built, then simplified, reviewed more broadly, tested, and explained. That kept the work moving while giving it a consistent standard.

| Area | What I contributed | What AI contributed |
|---|---|---|
| Product direction | Purpose, privacy priorities, access constraints, scope, and refinements | Helped organize the requirements and explore implementation tradeoffs |
| Planning | Approved the direction and kept the task bounded | Proposed architecture, implementation order, and verification steps |
| Implementation | Directed the requested behavior and subsequent changes | Wrote substantial frontend, backend, database, session, and workflow code |
| Interface | Selected the simpler task-focused experience and shared-device priorities | Implemented the revised screens, states, focus handling, and responsive layouts |
| Quality | Requested broader feature testing and whole-project review before publication | Wrote and ran tests, reproduced failures, fixed defects, and performed separate AI reviews |
| Documentation | Asked for purpose, rationale, and an honest development account | Drafted and revised the README, technical notes, and process documents |
| Release | Signed in to hosting services and authorized publication | Configured the deployment, published the prepared source, and checked the live app |

AI was a substantial development tool throughout this project. It is not an identity-matching or decision-making feature inside PING. Staff review possible matches, residents make disclosure choices, and server rules enforce the workflow.

## From first implementation to public demo

### Initial build — October 16

The approved plan used React/Vite, TypeScript, an Express API, PostgreSQL, runtime validation, and a Leaflet help-desk map. A real backend and database mattered because permissions, persistence, and duplicate retries were central to the idea.

The initial implementation covered registration, account cards, resident login, matching, private delivery, reply previews, separate shelter consent, assistance, safeguarding restrictions, and isolated fictional demo workspaces.

The recorded checkpoint passed **14 API tests and seven Chromium scenarios** after fixes. Testing and AI review found problems including ambiguous demo identity lookup, failed account-card recovery, missing requester assistance, and a session-save race after logout. These findings showed why a complete-looking flow still needed closer inspection.

### Shared-tablet revision — October 18

The next pass preserved the original project in a separate working copy, reran the baseline, and reproduced the identified defects before changing the interface.

Successful staff sign-ins had been counting toward an account throttle. Assistance claims could also create permanent case access. The fixes preserved failed-login and IP protections while removing the unintended claim-time grant. New tests used staff without existing case permission, so seeded access could not hide the problem.

The interface revision simplified the home and resident screens, made staff tasks visible across screen sizes, separated loading from errors and empty states, retained in-memory drafts, and improved keyboard focus and expiry warnings. A further AI review found focus and stale-preference issues, which also received regression tests.

That checkpoint passed **19 API tests and 22 Chromium scenarios**, plus the build.

### Broader review and release — October 18

My request for broader testing added coverage of staff-created requests, assistance handoff, preference changes, safeguarding acknowledgments, failed loads, and cross-tab login. It caught an assistance update-ordering bug and stale session/CSRF state. The remaining safeguarding intake-linkage limitation was documented rather than presented as a complete operational feature.

The expanded local checkpoint passed **24 API tests and 28 Chromium scenarios**. The local dependency audit reported zero known vulnerabilities at that time.

Publication added another useful verification environment. Linux CI exposed a login-form remount during background session renewal. Controlled tests also exposed a cross-tab logout timing problem, and repeat local startup revealed that the database helper needed to reuse an existing database cluster. Those issues were fixed; a registration test was corrected to wait for logout completion.

The final release CI passed **24 API tests, 29 Chromium scenarios, and the production build**. The agent then checked the deployed API and walked through the public browser flow. A Render service restart preserved a personal-device session and its approved reply and shelter data.

The source is at [DavidG214/ping](https://github.com/DavidG214/ping), and the fictional demo is at [ping-davidg214.onrender.com](https://ping-davidg214.onrender.com). The [verification record](verification.md) keeps the dated results and the limits of each check.

After publication, I asked for the example to be easier to follow while keeping the README in depth. I also asked for the live example to be run more than once with Playwright. The resulting public-site suite passed four checks, including the full reply and separate shelter flow in fresh desktop and tablet-sized sessions. That final pass helped connect the written instructions to what a reviewer would actually experience.

## What I take from the project

The part I am proud of is the consistency of the decisions. Access without a personal phone, recipient control, separate location consent, shared-device privacy, and a simpler interface all support the same purpose. I kept that purpose visible as the project moved through implementation, revisions, testing, and release.

I also think I used AI well by giving it direction and asking it to demonstrate the result. The generated code still needed debugging. The tests themselves sometimes needed correction. Review found things the first walkthrough missed. Continuing to ask for evidence helped turn an idea into a more defensible demo.

There is still a clear boundary around what I built. PING uses fictional data. It has not been validated through user interviews or field deployment. Actual shared-tablet hardware, screen readers, Safari/Firefox, disaster-scale load, and real safeguarding operations remain unverified. A successful web-service restart is not a database disaster-recovery test.

Within that scope, I took a sensitive problem, made deliberate product choices, used AI to implement and challenge those choices, and followed the project through to something another person can open and try.

## Connecting this with my earlier brainstorming

This reflection covers the implementation history available in the repository and project conversation. My separate brainstorming chat can supply the earlier idea exploration, personal motivation, and alternatives. That chat and the full challenge rubric were not available when this account was drafted; this document does not reconstruct them or reproduce casual chat transcripts.

Useful supporting files:

- [README](../README.md): purpose, walkthrough, design rationale, architecture, and setup.
- [AI-use log](ai-use.md): shorter attribution and development timeline.
- [Implementation plan](implementation-plan.md), [decision log](decisions.md), and [tablet implementation](tablet-implementation.md): recorded plans and changes.
- [Verification](verification.md): observed results, fixes, and unverified environments.
- [API notes](api.md) and [staff process](staff-process.md): permissions and workflow boundaries.
- [API tests](../tests/api.test.ts) and [browser tests](../tests/browser/): executable checks.
