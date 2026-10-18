import type { Express, Request } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { loginInput, type Actor } from "../shared/contracts";
import {
  digest,
  hashCredential,
  normalizeCode,
  verifyCredential,
} from "./security";
import {
  type Config,
  HttpError,
  requireActor,
  transaction,
  setAssistance,
  found,
} from "./context";
import { seedWorkspace } from "../db/seed";
const sessionInfo = (req: Request, config: Config) => ({
  csrf: req.session.csrf,
  actor: req.session.actor || null,
  demo: config.demo,
  hasDemo: !!req.session.demoId,
  idleAt: req.session.idleAt,
  absoluteAt: req.session.absoluteAt,
  warningMs: req.session.warningMs,
  sharedDevice: req.session.sharedDevice,
});
async function regenerate(
  req: Request,
  config: Config,
  actor?: Actor,
  shared = true,
  demoId = req.session.demoId,
) {
  // A late store UPSERT from an in-flight request must never re-authorize this SID.
  await config.pool.query(
    "INSERT INTO revoked_sessions VALUES($1,now()+interval '9 hours') ON CONFLICT DO NOTHING",
    [req.sessionID],
  );
  await new Promise<void>((resolve, reject) =>
    req.session.regenerate((err) => (err ? reject(err) : resolve())),
  );
  req.session.csrf = randomBytes(32).toString("hex");
  req.session.demoId = demoId;
  req.session.actor = actor;
  req.session.sharedDevice = shared;
  if (actor) {
    const staff = actor.role !== "resident";
    req.session.idleMs = staff ? 600000 : shared ? 120000 : 900000;
    req.session.warningMs = staff || !shared ? 60000 : 30000;
    req.session.idleAt = Date.now() + req.session.idleMs;
    req.session.absoluteAt =
      Date.now() + (staff || !shared ? 28800000 : 1800000);
    if (staff || !shared) req.session.cookie.maxAge = 28800000;
    else req.session.cookie.expires = undefined;
  }
}
export function authRoutes(app: Express, config: Config) {
  const dummy = hashCredential(randomBytes(32).toString("hex"), config.pepper);
  async function limit(key: string, max: number, seconds: number) {
    const row = (
      await config.pool.query(
        `INSERT INTO login_attempts VALUES($1,1,now()+$2*interval '1 second') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_attempts.resets_at<now() THEN 1 ELSE login_attempts.attempts+1 END,resets_at=CASE WHEN login_attempts.resets_at<now() THEN now()+$2*interval '1 second' ELSE login_attempts.resets_at END RETURNING attempts`,
        [key, seconds],
      )
    ).rows[0];
    if (row.attempts > max)
      throw new HttpError(
        429,
        "Too many attempts. Please wait before trying again.",
      );
  }
  app.get("/api/session", (req, res) => res.json(sessionInfo(req, config)));
  app.post("/api/session/activity", (req, res) => {
    requireActor(req);
    req.session.idleAt = Math.min(
      Date.now() + req.session.idleMs!,
      req.session.absoluteAt!,
    );
    res.json(sessionInfo(req, config));
  });
  app.post("/api/auth/logout", async (req, res) => {
    await regenerate(req, config);
    res.json(sessionInfo(req, config));
  });
  app.post("/api/auth/resident", async (req, res) => {
    const p = loginInput.parse(req.body),
      normalized = normalizeCode(p.code),
      key = "code:" + digest(normalized, config.pepper);
    await limit("ip:" + digest(req.ip || "", config.pepper), 100, 900);
    await limit(key, 5, 900);
    const r = (
      await config.pool.query(
        "SELECT r.*,c.pin_hash FROM resident_credentials c JOIN residents r ON r.id=c.resident_id JOIN workspaces w ON w.id=r.workspace_id WHERE c.code=$1 AND w.expires_at>now()",
        [normalized],
      )
    ).rows[0];
    const valid = await verifyCredential(
      r?.pin_hash || (await dummy),
      p.pin,
      config.pepper,
    );
    if (!valid || !r || (config.demo && r.workspace_id !== req.session.demoId))
      throw new HttpError(401, "Unable to sign in with those details.");
    await transaction(config.pool, async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        r.workspace_id,
      ]);
      await setAssistance(c, r.workspace_id, r.id, p.assistance);
      await c.query("DELETE FROM login_attempts WHERE key=$1", [key]);
    });
    await regenerate(
      req,
      config,
      {
        id: r.id,
        workspaceId: r.workspace_id,
        role: "resident",
        shelterId: r.shelter_id,
      },
      p.sharedDevice,
    );
    res.json(sessionInfo(req, config));
  });
  app.post("/api/auth/staff", async (req, res) => {
    const p = z
      .object({
        username: z.string().min(1).max(150),
        password: z.string().min(1).max(200),
        sharedDevice: z.boolean(),
      })
      .strict()
      .parse(req.body);
    const key = "staff:" + digest(p.username, config.pepper);
    await limit("ip:" + digest(req.ip || "", config.pepper), 100, 900);
    await limit(key, 5, 900);
    const r = (
      await config.pool.query(
        "SELECT s.* FROM staff_accounts s JOIN workspaces w ON w.id=s.workspace_id WHERE username=$1 AND w.expires_at>now()",
        [p.username],
      )
    ).rows[0];
    const valid = await verifyCredential(
      r?.password_hash || (await dummy),
      p.password,
      config.pepper,
    );
    if (!valid || !r || (config.demo && r.workspace_id !== req.session.demoId))
      throw new HttpError(401, "Unable to sign in with those details.");
    await config.pool.query("DELETE FROM login_attempts WHERE key=$1", [key]);
    await regenerate(
      req,
      config,
      {
        id: r.id,
        workspaceId: r.workspace_id,
        role: r.role,
        shelterId: r.shelter_id,
      },
      p.sharedDevice,
    );
    res.json(sessionInfo(req, config));
  });
  app.post("/api/demo/start", async (req, res) => {
    if (!config.demo) throw new HttpError(404, "Not found.");
    await limit("demo:" + digest(req.ip || "", config.pepper), 10, 3600);
    const scenario = await transaction(config.pool, async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(734821)");
      await c.query("DELETE FROM revoked_sessions WHERE expires_at<now()");
      await c.query("DELETE FROM sessions WHERE expire<now()");
      if (
        (
          await c.query(
            "SELECT value FROM app_settings WHERE key='environment'",
          )
        ).rows[0]?.value !== "demo"
      )
        throw new HttpError(503, "Demo configuration is unavailable.");
      await c.query(
        "DELETE FROM workspaces WHERE id IN (SELECT id FROM workspaces WHERE expires_at<now() LIMIT 20)",
      );
      if (
        Number(
          (await c.query("SELECT count(*) FROM workspaces")).rows[0].count,
        ) >= 500
      )
        throw new HttpError(
          503,
          "The demo is at capacity. Please try again later.",
        );
      return seedWorkspace(c, config.pepper);
    });
    await regenerate(req, config, undefined, true, scenario.id);
    res.status(201).json({ ...scenario, ...sessionInfo(req, config) });
  });
  app.get("/api/demo/guide", async (req, res) => {
    if (!config.demo || !req.session.demoId)
      throw new HttpError(404, "Not found.");
    found(
      (
        await config.pool.query(
          "SELECT id FROM workspaces WHERE id=$1 AND expires_at>now()",
          [req.session.demoId],
        )
      ).rows[0],
    );
    const rows = (
      await config.pool.query(
        'SELECT r.demo_key,r.id,r.name,r.shelter_id AS "shelterId",c.code FROM residents r JOIN resident_credentials c ON c.resident_id=r.id WHERE r.workspace_id=$1 AND r.demo_key IS NOT NULL',
        [req.session.demoId],
      )
    ).rows;
    res.json({
      residents: Object.fromEntries(
        rows.map(({ demo_key, ...r }) => [demo_key, { ...r, pin: "001234" }]),
      ),
    });
  });
  app.post("/api/demo/role", async (req, res) => {
    if (!config.demo || !req.session.demoId)
      throw new HttpError(404, "Not found.");
    const { role } = z
      .object({ role: z.enum(["A", "B", "C", "safeguarding"]) })
      .strict()
      .parse(req.body);
    const staff = found(
      (
        await config.pool.query(
          "SELECT s.* FROM staff_accounts s JOIN workspaces w ON w.id=s.workspace_id WHERE s.workspace_id=$1 AND s.username=$2 AND w.expires_at>now()",
          [req.session.demoId, `${req.session.demoId}-${role}`],
        )
      ).rows[0],
    );
    await regenerate(req, config, {
      id: staff.id,
      workspaceId: staff.workspace_id,
      role: staff.role,
      shelterId: staff.shelter_id,
    });
    res.json(sessionInfo(req, config));
  });
  app.post("/api/demo/reset", async (req, res) => {
    if (!config.demo || !req.session.demoId)
      throw new HttpError(404, "Not found.");
    await transaction(config.pool, async (c) => {
      await c.query("DELETE FROM sessions WHERE sess->>'demoId'=$1", [
        req.session.demoId,
      ]);
      await c.query("DELETE FROM workspaces WHERE id=$1", [req.session.demoId]);
    });
    await regenerate(req, config);
    delete req.session.demoId;
    res.json(sessionInfo(req, config));
  });
}
