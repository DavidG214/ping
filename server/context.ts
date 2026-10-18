import type pg from "pg";
import type { Request, Response, NextFunction } from "express";
import type { Actor } from "../shared/contracts";
import { digest } from "./security";
export type Config = {
  pool: pg.Pool;
  origin: string;
  secret: string;
  pepper: string;
  demo: boolean;
  production: boolean;
};
declare module "express-session" {
  interface SessionData {
    csrf: string;
    actor?: Actor;
    demoId?: string;
    sharedDevice?: boolean;
    idleAt?: number;
    absoluteAt?: number;
    idleMs?: number;
    warningMs?: number;
  }
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireActor(req: Request, roles?: string[]) {
  const a = req.session.actor;
  if (!a) throw new HttpError(401, "Sign in to continue.");
  if (roles && !roles.includes(a.role)) throw new HttpError(404, "Not found.");
  return a;
}
export function found<T>(value: T | undefined): T {
  if (!value) throw new HttpError(404, "Not found.");
  return value;
}
export async function transaction<T>(
  pool: pg.Pool,
  fn: (c: pg.PoolClient) => Promise<T>,
) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const result = await fn(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export function mutation(
  config: Config,
  roles: string[],
  fn: (req: Request, c: pg.PoolClient, a: Actor) => Promise<object>,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const a = requireActor(req, roles),
        key = req.get("Idempotency-Key");
      if (!key || !/^[a-zA-Z0-9-]{16,80}$/.test(key))
        throw new HttpError(400, "A retry key is required.");
      const fingerprint = digest(
        req.path + JSON.stringify(req.body),
        config.pepper,
      );
      const result = await transaction(config.pool, async (c) => {
        await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          a.workspaceId,
        ]);
        if (
          (
            await c.query(
              "SELECT 1 FROM revoked_sessions WHERE sid=$1 AND expires_at>now()",
              [req.sessionID],
            )
          ).rowCount
        )
          throw new HttpError(
            401,
            "Your session expired. Sign in again to continue.",
          );
        found(
          (
            await c.query(
              "SELECT id FROM workspaces WHERE id=$1 AND expires_at>now()",
              [a.workspaceId],
            )
          ).rows[0],
        );
        const old = (
          await c.query(
            "SELECT fingerprint,result FROM mutation_receipts WHERE workspace_id=$1 AND actor_id=$2 AND key=$3",
            [a.workspaceId, a.id, key],
          )
        ).rows[0];
        if (old) {
          if (old.fingerprint !== fingerprint)
            throw new HttpError(
              409,
              "This retry key was already used for a different action.",
            );
          return old.result;
        }
        const result = await fn(req, c, a);
        await c.query("INSERT INTO mutation_receipts VALUES($1,$2,$3,$4,$5)", [
          a.workspaceId,
          a.id,
          key,
          fingerprint,
          JSON.stringify(result),
        ]);
        await c.query(
          "INSERT INTO audit_events(workspace_id,actor_id,action,target_id) VALUES($1,$2,$3,$4)",
          [a.workspaceId, a.id, req.route.path, req.params.id || null],
        );
        return result;
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  };
}
export const residentFields =
  'id,name,age_band AS "ageBand",clue,description,language,assistance,shelter_id AS "shelterId",safeguarding';
export async function setAssistance(
  c: pg.PoolClient,
  workspace: string,
  resident: string,
  value: boolean,
) {
  await c.query(
    "UPDATE residents SET assistance=$3 WHERE workspace_id=$1 AND id=$2",
    [workspace, resident, value],
  );
  if (value)
    await c.query(
      `INSERT INTO assistance_tasks(id,workspace_id,delivery_id,state)
    SELECT gen_random_uuid(),d.workspace_id,d.id,'pending' FROM deliveries d JOIN search_requests r ON r.id=d.request_id
    JOIN residents p ON p.id=d.resident_id WHERE d.workspace_id=$1 AND d.resident_id=$2 AND d.state='pending' AND NOT r.safeguarding AND NOT p.safeguarding
    ON CONFLICT(workspace_id,delivery_id) DO UPDATE SET state='pending',claimant_id=null,lease_until=null WHERE assistance_tasks.state='cancelled'`,
      [workspace, resident],
    );
  else
    await c.query(
      `UPDATE assistance_tasks t SET state='cancelled',claimant_id=null,lease_until=null FROM deliveries d WHERE t.delivery_id=d.id AND d.workspace_id=$1 AND d.resident_id=$2 AND t.state IN ('pending','claimed')`,
      [workspace, resident],
    );
  if (value) await queueReplyAssistance(c, workspace, resident);
  else
    await c.query(
      "UPDATE assistance_tasks SET state='cancelled',claimant_id=null,lease_until=null WHERE id IN (SELECT id FROM assistance_items WHERE workspace_id=$1 AND resident_id=$2) AND state IN ('pending','claimed')",
      [workspace, resident],
    );
}

export async function queueReplyAssistance(
  c: pg.PoolClient,
  workspace: string,
  resident: string,
  reopen = false,
  requestId: string | null = null,
) {
  await c.query(
    `INSERT INTO assistance_tasks(id,workspace_id,response_id,state)
    SELECT gen_random_uuid(),q.workspace_id,r.id,'pending' FROM responses r JOIN search_requests q ON q.id=r.request_id JOIN residents p ON p.id=q.requester_id
    WHERE q.workspace_id=$1 AND q.requester_id=$2 AND p.assistance AND NOT p.safeguarding AND NOT q.safeguarding AND ($4::uuid IS NULL OR q.id=$4)
    ON CONFLICT(workspace_id,response_id) DO UPDATE SET state='pending',claimant_id=null,lease_until=null WHERE assistance_tasks.state='cancelled' OR ($3 AND assistance_tasks.state IN ('presented','claimed'))`,
    [workspace, resident, reopen, requestId],
  );
}
