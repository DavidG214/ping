# Restricted staff processes

This is an explanatory prototype process, not a validated emergency-services policy. No real cases should be entered.

## Safeguarding

1. At intake, record an age range or unknown. Mark any inability-to-consent or other sensitive concern. Children and unknown-age cases are restricted automatically.
2. The ordinary matching, delivery, reply and shelter-release paths remain blocked. Neither family claims nor shared clues override this.
3. Designated safeguarding staff see assigned referrals and can acknowledge receipt. They follow the participating organization's private safeguarding process outside PING.
4. Any identity, custody, safe-contact or reunification determination requires that organization's qualified staff and policy. This prototype does not make or record an approval for release.

The UI deliberately has no “approve child disclosure” button. Do not resolve uncertainty by silently changing an age to adult. Future real deployments require access governance, training, retention rules, supervision and independent security/operational review.

The current panel displays an assigned referral UUID, reason and acknowledgment only. It does not expose the person's identity or an external intake-record link. The reference distinguishes entries, but PING alone cannot tell staff which real person to contact; completing operational intake linkage is deferred. This is a fictional restricted-flow demonstration, not a usable end-to-end safeguarding case-management system.

## Lost account code or PIN

1. Direct the person privately to designated staff. Do not read out possible account matches or confirm that another person's record exists.
2. Do not accept name, date of birth, a claimed relationship, or knowledge of matching clues as sufficient recovery evidence.
3. Supervisory staff must use independent, context-appropriate evidence under the organization's recovery and safeguarding policy. If sufficient evidence cannot be established, do not disclose or reset the existing account.
4. An authorized future recovery implementation would revoke every old session, replace the account code and PIN hash, issue a new code-only card, and create a restricted audit event. It must not preserve the old credentials as a fallback.

There is intentionally no recovery/reset API in the MVP. No production recovery can be completed by guessing a name or answering security questions.

## Assistance handoff

Claim a task before reading its message. Present it privately, then mark presented or release it for another volunteer. Claims expire after 10 minutes. A resident must authenticate and approve any reply or shelter disclosure themselves. Staff can update assistance preference only at the resident's request; the setting persists across logout. If assistance is disabled mid-task, stop delivery and close the panel. Already observed information cannot be retracted.

If a resident separately shares a shelter while an approved reply is already claimed, that claim is invalidated and the task returns to the queue. Reclaim it to view the updated approved disclosure before marking it presented. Claiming assistance never grants permanent case/card access.

## Abuse and matching mistakes

Respect silence. A declined or wrong-person candidate is excluded from that same request, with no requester notification. Do not merge duplicate names or assume clues verify identity. Escalate concerning repeated requests through the organization's process. Cross-request blocking and anti-harassment enforcement are deferred and must be designed before real use.
