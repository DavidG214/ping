import express from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import helmet from "helmet";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import path from "node:path";
import { HttpError, type Config } from "./context";
import { authRoutes } from "./auth";
import { workflowRoutes } from "./workflows";
import { staffRoutes } from "./staff";
export type { Config } from "./context";
export function createApp(config: Config) {
  const app = express();
  app.disable("x-powered-by");
  if (config.production) app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https://tile.openstreetmap.org"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: config.production ? [] : null,
        },
      },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      strictTransportSecurity: config.production ? undefined : false,
    }),
  );
  app.use(express.json({ limit: "16kb" }));
  app.get("/api/health", async (_req, res) => {
    await config.pool.query("SELECT 1");
    res.json({ ok: true });
  });
  app.get("/api/shelters", async (_req, res) =>
    res.json(
      (
        await config.pool.query(
          "SELECT *,true AS demo FROM shelters ORDER BY id",
        )
      ).rows,
    ),
  );
  const Store = connectPg(session);
  app.use(
    "/api",
    session({
      name: config.production ? "__Host-ping" : "ping.sid",
      secret: config.secret,
      resave: false,
      saveUninitialized: false,
      store: new Store({
        pool: config.pool,
        tableName: "sessions",
        pruneSessionInterval: false,
      }),
      cookie: {
        httpOnly: true,
        secure: config.production,
        sameSite: "strict",
        path: "/",
        maxAge: 8 * 60 * 60 * 1000,
      },
    }),
  );
  app.use("/api", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    req.session.csrf ||= randomBytes(32).toString("hex");
    if (
      (
        await config.pool.query(
          "SELECT 1 FROM revoked_sessions WHERE sid=$1 AND expires_at>now()",
          [req.sessionID],
        )
      ).rowCount
    ) {
      res.clearCookie(config.production ? "__Host-ping" : "ping.sid", {
        path: "/",
        httpOnly: true,
        secure: config.production,
        sameSite: "strict",
      });
      await new Promise<void>((resolve, reject) =>
        req.session.destroy((err) => (err ? reject(err) : resolve())),
      );
      return next(
        new HttpError(401, "Your session expired. Sign in again to continue."),
      );
    }
    if (req.session.actor) {
      const s = req.session;
      const valid =
        Date.now() < (s.idleAt || 0) &&
        Date.now() < (s.absoluteAt || 0) &&
        (
          await config.pool.query(
            "SELECT id FROM workspaces WHERE id=$1 AND expires_at>now()",
            [s.actor!.workspaceId],
          )
        ).rowCount;
      if (!valid) {
        delete s.actor;
        delete s.idleAt;
        delete s.absoluteAt;
      }
    }
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      (req.get("Origin") !== config.origin ||
        req.get("X-CSRF-Token") !== req.session.csrf)
    )
      return next(new HttpError(403, "Refresh this page before trying again."));
    next();
  });
  authRoutes(app, config);
  workflowRoutes(app, config);
  staffRoutes(app, config);
  app.use("/api", (_req, _res, next) => next(new HttpError(404, "Not found.")));
  app.use(express.static(path.resolve("dist/client"), { index: false }));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.resolve("dist/client/index.html")),
  );
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (err instanceof z.ZodError)
        return res.status(400).json({
          error: "Check the form fields and try again.",
          fields: err.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        });
      if (err instanceof HttpError)
        return res.status(err.status).json({ error: err.message });
      const e = err as { code?: string; status?: number };
      if (e.code === "22P02")
        return res.status(404).json({ error: "Not found." });
      if (e.code === "23505")
        return res.status(409).json({
          error:
            "This action has already been completed. Refresh to check its status.",
        });
      if (e.status === 400 || e.status === 413)
        return res
          .status(e.status)
          .json({ error: "The submitted form could not be read." });
      console.error("Request failed", e.code || "internal");
      res.status(503).json({
        error:
          "PING is unavailable. Your send status may be unknown. Reconnect and check before retrying.",
      });
    },
  );
  return app;
}
