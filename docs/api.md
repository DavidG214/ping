# API and access notes

All private endpoints use a server session, workspace scope, no-store responses, and explicit JSON projections. Mutations require matching Origin and X-CSRF-Token. Workflow mutations additionally require an Idempotency-Key (16–80 letters/digits/hyphens); keys are scoped to actor and workspace. Conflicting reuse returns 409. Responses to unauthorized object access and missing objects are both 404. Unauthenticated access is 401. Invalid forms are 400; throttle responses are 429; dependency failures are 503 with uncertain-send language.

## Public/session

| Route                        | Contract                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------ |
| GET `/api/shelters`          | Array of id, name, public demo address, lat, lng, demo=true                    |
| GET `/api/health`            | Database-backed `{ok:true}`                                                    |
| GET `/api/session`           | CSRF token, scoped actor or null, device/expiry metadata, demo availability    |
| POST `/api/auth/resident`    | code, six-digit PIN string, sharedDevice boolean, assistance boolean → session |
| POST `/api/auth/staff`       | username, password, sharedDevice → session                                     |
| POST `/api/auth/logout`      | Revokes old session; preserves only fictional workspace capability             |
| POST `/api/session/activity` | User-interaction renewal, capped by absolute deadline                          |

## Resident

| Route                                       | Contract                                                                                           |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| GET `/api/me`                               | Own noncredential profile                                                                          |
| PATCH `/api/me/preferences`                 | assistance boolean → saved preference                                                              |
| GET `/api/me/requests`                      | Own submitted search fields/message/request timestamp, coarse status, approved reply/location only |
| GET `/api/me/inbox`                         | Assigned actionable/replied deliveries; seeker-approved name/message and limited clues             |
| POST `/api/deliveries/:id/preview`          | text, optional shelterId, atShelter → exact disclosure and signed five-minute token                |
| POST `/api/deliveries/:id/reply`            | token → saved acknowledgment                                                                       |
| POST `/api/deliveries/:id/location-preview` | shelterId, atShelter=true → exact separate disclosure and token                                    |
| POST `/api/deliveries/:id/location`         | token → saved acknowledgment                                                                       |
| POST `/api/deliveries/:id/decision`         | decline or wrong_person → saved acknowledgment; no requester notification                          |

The requester response projection never includes delivery/candidate IDs, recipient account, internal state, matching counts, shelter without consent, or read/check-in timestamps. Only request creation time is shown. Message bodies are plain text, escaped by React.

## Staff

| Route                                                            | Scope                                                                                                      |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| GET/POST `/api/staff/residents`                                  | Own shelter profiles / registration                                                                        |
| GET `/api/staff/residents/:id`                                   | Own shelter only                                                                                           |
| POST `/api/staff/residents/:id/open-case`                        | Explicit audited local case grant                                                                          |
| GET `/api/staff/residents/:id/card`                              | Granted local case only; dedicated credential issuance; never PIN                                          |
| GET `/api/staff/residents/:id/requests`                          | Explicit granted local case; same requester-safe response projection                                       |
| POST `/api/staff/residents/:id/assistance`                       | Local resident-requested preference change                                                                 |
| POST `/api/staff/requests`                                       | Granted local requester; target clues, intended message, approved seeker display name                      |
| GET `/api/staff/matching-feed`                                   | Request ID, target name/age/clues/description and request timestamp; no recipient profiles or message body |
| POST `/api/staff/requests/:id/deliveries`                        | Local candidate only; blocks sensitive cases and repeated/active routing                                   |
| GET `/api/staff/assistance`                                      | Local task summaries, no message body                                                                      |
| POST `/api/staff/assistance/:id/claim`, `/release`, `/presented` | Current preference, local scope and lease checked transactionally                                          |
| GET `/api/staff/assistance/:id`                                  | Incoming request or approved reply, and separately approved location if any, only to current valid claimant |
| GET `/api/staff/safeguarding`                                    | Assigned safeguarding cases only                                                                           |
| POST `/api/staff/safeguarding/:id/acknowledge`                   | Acknowledgment only; never a disclosure override                                                           |

Staff cannot submit recipient replies or consent. An assisted resident signs in and confirms personally. All ordinary API serializers exclude codes/hashes; audit rows contain action and opaque target IDs, not message/clue bodies or credentials.

## Demo

POST `/api/demo/start` creates an isolated fictional workspace; GET `/api/demo/guide` exposes only explicitly marked seeded fictional credentials. POST `/api/demo/role` accepts A/B/C/safeguarding, resolving identities on the server within that workspace. POST `/api/demo/reset` revokes that workspace's sessions and deletes only its records. All demo routes are absent when demo mode is disabled; startup also verifies the database environment marker.

## Data relationships

Workspace → residents/staff/requests/deliveries/responses/assistance/safeguarding/audit/receipts. Residents → credential row. Request → requester and creating staff. Delivery → request and recipient. Response → request and delivery (one per request). Assistance → exactly one delivery or approved response, plus optional claimant. The assistance_items view projects each task to the resident who needs delivery. Case access explicitly joins staff and resident. Foreign keys include workspace scope; partial unique indexes permit only one active delivery per request.

PostgreSQL stores sessions and durable revoked-session IDs separately. Logout and session rotation revoke the previous ID before regeneration, so a late session-store write cannot restore access. Expired revocations are removed only after the maximum session lifetime.

Internal delivery states: pending, declined, wrong_person, replied, cancelled. Assistance: pending, claimed, presented, cancelled. Requester sees only received acknowledgment, waiting, or response available.
