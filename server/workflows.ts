import type { Express, Request } from "express";
import type pg from "pg";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { replyInput, locationInput } from "../shared/contracts";
import {
  type Config,
  requireActor,
  residentFields,
  mutation,
  setAssistance,
  queueReplyAssistance,
  found,
  HttpError,
} from "./context";
import { readPreview, signedPreview } from "./security";

export async function outgoing(
  db: pg.Pool | pg.PoolClient,
  workspace: string,
  resident: string,
) {
  const rows = (
    await db.query(
      `SELECT q.id,q.target_name,q.age_band,q.clue,q.description,q.message,q.created_at,r.text,r.location_name,r.location_address FROM search_requests q LEFT JOIN responses r ON r.request_id=q.id AND r.workspace_id=q.workspace_id WHERE q.workspace_id=$1 AND q.requester_id=$2 ORDER BY q.created_at,q.id`,
      [workspace, resident],
    )
  ).rows;
  return rows.map((r) => ({
    id: r.id,
    targetName: r.target_name,
    ageBand: r.age_band,
    clue: r.clue,
    description: r.description,
    message: r.message,
    createdAt: r.created_at,
    status: r.text ? "Response available" : "Waiting for a response",
    response: r.text
      ? {
          text: r.text,
          location: r.location_name
            ? {
                name: r.location_name,
                address: r.location_address,
                selfReported: true,
              }
            : null,
        }
      : null,
  }));
}
export function workflowRoutes(app: Express, config: Config) {
  app.get("/api/me", async (req, res) => {
    const a = requireActor(req, ["resident"]);
    res.json(
      found(
        (
          await config.pool.query(
            `SELECT ${residentFields} FROM residents WHERE workspace_id=$1 AND id=$2`,
            [a.workspaceId, a.id],
          )
        ).rows[0],
      ),
    );
  });
  const preferences = mutation(config, ["resident"], async (req, c, a) => {
    const { assistance } = z
      .object({ assistance: z.boolean() })
      .strict()
      .parse(req.body);
    await setAssistance(c, a.workspaceId, a.id, assistance);
    return { assistance };
  });
  app.patch("/api/me/preferences", preferences);
  app.post("/api/me/preferences", preferences);
  app.get("/api/me/requests", async (req, res) => {
    const a = requireActor(req, ["resident"]);
    res.json(await outgoing(config.pool, a.workspaceId, a.id));
  });
  app.get("/api/me/inbox", async (req, res) => {
    const a = requireActor(req, ["resident"]);
    const rows = (
      await config.pool.query(
        `SELECT d.id,d.state,q.seeker_name,q.message,q.target_name,q.clue,r.text,r.location_name,r.location_address FROM deliveries d JOIN search_requests q ON q.id=d.request_id JOIN residents p ON p.id=d.resident_id LEFT JOIN responses r ON r.delivery_id=d.id WHERE d.workspace_id=$1 AND d.resident_id=$2 AND d.state IN ('pending','replied') AND NOT q.safeguarding AND NOT p.safeguarding ORDER BY d.id`,
        [a.workspaceId, a.id],
      )
    ).rows;
    res.json(
      rows.map((r) => ({
        id: r.id,
        state: r.state,
        seekerName: r.seeker_name,
        message: r.message,
        targetName: r.target_name,
        clue: r.clue,
        response: r.text
          ? {
              text: r.text,
              location: r.location_name
                ? {
                    name: r.location_name,
                    address: r.location_address,
                    selfReported: true,
                  }
                : null,
            }
          : null,
      })),
    );
  });
  async function delivery(req: Request, db: pg.Pool | pg.PoolClient) {
    const a = requireActor(req, ["resident"]);
    const d = found(
      (
        await db.query(
          `SELECT d.*,q.safeguarding AS request_sensitive,p.safeguarding AS resident_sensitive FROM deliveries d JOIN search_requests q ON q.id=d.request_id JOIN residents p ON p.id=d.resident_id WHERE d.workspace_id=$1 AND d.id=$2 AND d.resident_id=$3`,
          [a.workspaceId, req.params.id, a.id],
        )
      ).rows[0],
    );
    if (d.request_sensitive || d.resident_sensitive)
      throw new HttpError(
        409,
        "This case needs designated safeguarding staff.",
      );
    return d;
  }
  for (const locationOnly of [false, true]) {
    const kind = locationOnly ? "location" : "reply";
    app.post(
      `/api/deliveries/:id/${locationOnly ? "location-preview" : "preview"}`,
      async (req, res) => {
        const a = requireActor(req, ["resident"]),
          d = await delivery(req, config.pool);
        if (d.state !== (locationOnly ? "replied" : "pending"))
          throw new HttpError(
            409,
            "This ping has changed. Refresh to check it.",
          );
        const p = locationOnly
          ? locationInput.parse(req.body)
          : replyInput.parse(req.body);
        if (p.shelterId && !p.atShelter)
          throw new HttpError(
            400,
            "Confirm you are at this shelter before sharing it.",
          );
        if (
          locationOnly &&
          (
            await config.pool.query(
              "SELECT shelter_id FROM responses WHERE delivery_id=$1",
              [d.id],
            )
          ).rows[0]?.shelter_id
        )
          throw new HttpError(409, "A shelter has already been shared.");
        const shelter = p.shelterId
          ? (
              await config.pool.query(
                "SELECT id,name,address FROM shelters WHERE id=$1",
                [p.shelterId],
              )
            ).rows[0]
          : null;
        const disclosure = {
          text: "text" in p ? p.text : undefined,
          location: shelter
            ? {
                name: shelter.name,
                address: shelter.address,
                selfReported: true,
              }
            : null,
        };
        res.json({
          disclosure,
          token: signedPreview(
            {
              actor: a.id,
              workspace: a.workspaceId,
              delivery: d.id,
              kind,
              text: "text" in p ? p.text : undefined,
              shelter: shelter || null,
              expires: Date.now() + 300000,
            },
            config.secret,
          ),
        });
      },
    );
    app.post(
      `/api/deliveries/:id/${kind}`,
      mutation(config, ["resident"], async (req, c, a) => {
        const { token } = z
          .object({ token: z.string().max(5000) })
          .strict()
          .parse(req.body);
        let p;
        try {
          p = readPreview(token, config.secret);
        } catch {
          throw new HttpError(400, "Preview this reply again before sending.");
        }
        if (
          p.actor !== a.id ||
          p.workspace !== a.workspaceId ||
          p.delivery !== req.params.id ||
          p.kind !== kind ||
          p.expires < Date.now()
        )
          throw new HttpError(
            409,
            "Your preview expired. Preview again before sending.",
          );
        const d = await delivery(req, c);
        if (d.state !== (locationOnly ? "replied" : "pending"))
          throw new HttpError(
            409,
            "This ping has changed. Refresh to check it.",
          );
        if (locationOnly) {
          const result = await c.query(
            "UPDATE responses SET shelter_id=$3,location_name=$4,location_address=$5 WHERE workspace_id=$1 AND delivery_id=$2 AND shelter_id IS NULL",
            [
              a.workspaceId,
              d.id,
              p.shelter.id,
              p.shelter.name,
              p.shelter.address,
            ],
          );
          if (!result.rowCount)
            throw new HttpError(409, "A shelter has already been shared.");
        } else {
          await c.query(
            "INSERT INTO responses(id,workspace_id,request_id,delivery_id,text,shelter_id,location_name,location_address) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
            [
              randomUUID(),
              a.workspaceId,
              d.request_id,
              d.id,
              p.text,
              p.shelter?.id || null,
              p.shelter?.name || null,
              p.shelter?.address || null,
            ],
          );
          await c.query("UPDATE deliveries SET state='replied' WHERE id=$1", [
            d.id,
          ]);
          await c.query(
            "UPDATE assistance_tasks SET state='cancelled',claimant_id=null,lease_until=null WHERE delivery_id=$1",
            [d.id],
          );
        }
        const requester = (
          await c.query(
            "SELECT requester_id FROM search_requests WHERE workspace_id=$1 AND id=$2",
            [a.workspaceId, d.request_id],
          )
        ).rows[0];
        await queueReplyAssistance(
          c,
          a.workspaceId,
          requester.requester_id,
          locationOnly,
          d.request_id,
        );
        return { id: d.id, saved: true };
      }),
    );
  }
  app.post(
    "/api/deliveries/:id/decision",
    mutation(config, ["resident"], async (req, c) => {
      const { decision } = z
          .object({ decision: z.enum(["decline", "wrong_person"]) })
          .strict()
          .parse(req.body),
        d = await delivery(req, c);
      if (d.state !== "pending")
        throw new HttpError(409, "This ping has changed. Refresh to check it.");
      await c.query("UPDATE deliveries SET state=$2 WHERE id=$1", [
        d.id,
        decision === "decline" ? "declined" : "wrong_person",
      ]);
      await c.query(
        "UPDATE assistance_tasks SET state='cancelled',claimant_id=null,lease_until=null WHERE delivery_id=$1",
        [d.id],
      );
      return { saved: true };
    }),
  );
}
