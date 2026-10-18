import type { Express } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { residentInput, requestInput, sensitiveAge } from "../shared/contracts";
import {
  type Config,
  requireActor,
  residentFields,
  mutation,
  setAssistance,
  found,
  HttpError,
} from "./context";
import { code, hashCredential } from "./security";
import { outgoing } from "./workflows";
export function staffRoutes(app: Express, config: Config) {
  const staff = ["volunteer", "safeguarding"];
  app.get("/api/staff/residents", async (req, res) => {
    const a = requireActor(req, staff);
    res.json(
      (
        await config.pool.query(
          `SELECT ${residentFields} FROM residents WHERE workspace_id=$1 AND shelter_id=$2 ORDER BY name`,
          [a.workspaceId, a.shelterId],
        )
      ).rows,
    );
  });
  app.get("/api/staff/residents/:id", async (req, res) => {
    const a = requireActor(req, staff);
    res.json(
      found(
        (
          await config.pool.query(
            `SELECT ${residentFields} FROM residents WHERE workspace_id=$1 AND shelter_id=$2 AND id=$3`,
            [a.workspaceId, a.shelterId, req.params.id],
          )
        ).rows[0],
      ),
    );
  });
  app.post(
    "/api/staff/residents",
    mutation(config, staff, async (req, c, a) => {
      const p = residentInput.parse(req.body),
        id = randomUUID(),
        sensitive = p.safeguarding || sensitiveAge(p.ageBand);
      await c.query(
        "INSERT INTO residents(id,workspace_id,name,age_band,clue,description,language,assistance,shelter_id,safeguarding) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [
          id,
          a.workspaceId,
          p.name,
          p.ageBand,
          p.clue,
          p.description,
          p.language,
          p.assistance,
          a.shelterId,
          sensitive,
        ],
      );
      await c.query("INSERT INTO resident_credentials VALUES($1,$2,$3)", [
        id,
        code(),
        await hashCredential(p.pin, config.pepper),
      ]);
      await c.query("INSERT INTO case_access VALUES($1,$2,$3)", [
        a.workspaceId,
        a.id,
        id,
      ]);
      if (sensitive)
        await c.query(
          `INSERT INTO safeguarding_cases(id,workspace_id,resident_id,assigned_to,reason) SELECT $1,$2,$3,id,$4 FROM staff_accounts WHERE workspace_id=$2 AND role='safeguarding' LIMIT 1`,
          [
            randomUUID(),
            a.workspaceId,
            id,
            "Age unknown, child, or consent concern. No ordinary disclosure.",
          ],
        );
      return { id, safeguarding: sensitive };
    }),
  );
  app.get("/api/staff/residents/:id/card", async (req, res) => {
    const a = requireActor(req, staff);
    const r = found(
      (
        await config.pool.query(
          "SELECT r.name,c.code FROM residents r JOIN resident_credentials c ON c.resident_id=r.id JOIN case_access x ON x.resident_id=r.id AND x.staff_id=$3 WHERE r.workspace_id=$1 AND r.id=$2 AND r.shelter_id=$4",
          [a.workspaceId, req.params.id, a.id, a.shelterId],
        )
      ).rows[0],
    );
    await config.pool.query(
      "INSERT INTO audit_events(workspace_id,actor_id,action,target_id) VALUES($1,$2,$3,$4)",
      [a.workspaceId, a.id, "account_card", req.params.id],
    );
    res.json(r);
  });
  app.post(
    "/api/staff/residents/:id/open-case",
    mutation(config, staff, async (req, c, a) => {
      found(
        (
          await c.query(
            "SELECT id FROM residents WHERE workspace_id=$1 AND id=$2 AND shelter_id=$3",
            [a.workspaceId, req.params.id, a.shelterId],
          )
        ).rows[0],
      );
      await c.query(
        "INSERT INTO case_access VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [a.workspaceId, a.id, req.params.id],
      );
      return { saved: true };
    }),
  );
  app.get("/api/staff/residents/:id/requests", async (req, res) => {
    const a = requireActor(req, staff);
    found(
      (
        await config.pool.query(
          "SELECT 1 FROM case_access x JOIN residents r ON r.id=x.resident_id WHERE x.workspace_id=$1 AND x.staff_id=$2 AND x.resident_id=$3 AND r.shelter_id=$4",
          [a.workspaceId, a.id, req.params.id, a.shelterId],
        )
      ).rows[0],
    );
    res.json(await outgoing(config.pool, a.workspaceId, String(req.params.id)));
  });
  app.post(
    "/api/staff/residents/:id/assistance",
    mutation(config, staff, async (req, c, a) => {
      const { assistance } = z
        .object({ assistance: z.boolean() })
        .strict()
        .parse(req.body);
      found(
        (
          await c.query(
            "SELECT id FROM residents WHERE workspace_id=$1 AND id=$2 AND shelter_id=$3",
            [a.workspaceId, req.params.id, a.shelterId],
          )
        ).rows[0],
      );
      await setAssistance(c, a.workspaceId, String(req.params.id), assistance);
      return { assistance };
    }),
  );
  app.post(
    "/api/staff/requests",
    mutation(config, staff, async (req, c, a) => {
      const p = requestInput.parse(req.body);
      const resident = found(
        (
          await c.query(
            "SELECT r.* FROM residents r JOIN case_access x ON x.resident_id=r.id AND x.staff_id=$3 WHERE r.workspace_id=$1 AND r.id=$2 AND r.shelter_id=$4",
            [a.workspaceId, p.requesterId, a.id, a.shelterId],
          )
        ).rows[0],
      );
      const id = randomUUID(),
        sensitive = resident.safeguarding || sensitiveAge(p.ageBand);
      await c.query(
        "INSERT INTO search_requests(id,workspace_id,requester_id,created_by,target_name,age_band,clue,description,message,seeker_name,safeguarding) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        [
          id,
          a.workspaceId,
          p.requesterId,
          a.id,
          p.targetName,
          p.ageBand,
          p.clue,
          p.description,
          p.message,
          p.seekerName,
          sensitive,
        ],
      );
      if (sensitive)
        await c.query(
          `INSERT INTO safeguarding_cases(id,workspace_id,request_id,resident_id,assigned_to,reason) SELECT $1,$2,$3,$4,id,$5 FROM staff_accounts WHERE workspace_id=$2 AND role='safeguarding' LIMIT 1`,
          [
            randomUUID(),
            a.workspaceId,
            id,
            p.requesterId,
            "Requester or target needs safeguarding review.",
          ],
        );
      return { id, status: "Request received" };
    }),
  );
  app.get("/api/staff/matching-feed", async (req, res) => {
    const a = requireActor(req, staff);
    const rows = (
      await config.pool.query(
        `SELECT q.id,q.target_name AS "targetName",q.age_band AS "ageBand",q.clue,q.description,q.created_at AS "createdAt" FROM search_requests q WHERE q.workspace_id=$1 AND NOT q.safeguarding AND NOT EXISTS(SELECT 1 FROM responses r WHERE r.request_id=q.id) ORDER BY q.created_at,q.id`,
        [a.workspaceId],
      )
    ).rows;
    res.json(rows);
  });
  app.post(
    "/api/staff/requests/:id/deliveries",
    mutation(config, staff, async (req, c, a) => {
      const { residentId } = z
        .object({ residentId: z.uuid() })
        .strict()
        .parse(req.body);
      const r = found(
        (
          await c.query(
            "SELECT * FROM residents WHERE workspace_id=$1 AND id=$2 AND shelter_id=$3",
            [a.workspaceId, residentId, a.shelterId],
          )
        ).rows[0],
      );
      const q = found(
        (
          await c.query(
            "SELECT * FROM search_requests WHERE workspace_id=$1 AND id=$2",
            [a.workspaceId, req.params.id],
          )
        ).rows[0],
      );
      if (q.safeguarding || r.safeguarding)
        throw new HttpError(
          409,
          "This case needs designated safeguarding staff.",
        );
      if (
        (
          await c.query(
            "SELECT id FROM deliveries WHERE workspace_id=$1 AND request_id=$2 AND (resident_id=$3 OR state IN ('pending','replied'))",
            [a.workspaceId, q.id, residentId],
          )
        ).rowCount
      )
        throw new HttpError(
          409,
          "This request cannot be routed to this candidate. It may already be assigned or previously declined.",
        );
      const id = randomUUID();
      await c.query(
        "INSERT INTO deliveries(id,workspace_id,request_id,resident_id) VALUES($1,$2,$3,$4)",
        [id, a.workspaceId, q.id, residentId],
      );
      if (r.assistance) await setAssistance(c, a.workspaceId, r.id, true);
      return { id, saved: true };
    }),
  );
  app.get("/api/staff/assistance", async (req, res) => {
    const a = requireActor(req, staff);
    const rows = (
      await config.pool.query(
        `SELECT id,CASE WHEN state='claimed' AND lease_until<now() THEN 'pending' ELSE state END AS state,name,language,kind,(claimant_id=$3 AND lease_until>now()) AS mine FROM assistance_items WHERE workspace_id=$1 AND shelter_id=$2 AND assistance AND NOT resident_sensitive AND NOT request_sensitive AND actionable AND state IN ('pending','claimed') ORDER BY id`,
        [a.workspaceId, a.shelterId, a.id],
      )
    ).rows;
    res.json(rows);
  });
  app.get("/api/staff/assistance/:id", async (req, res) => {
    const a = requireActor(req, staff);
    const r = found(
      (
        await config.pool.query(
          `SELECT id,name,seeker_name AS "seekerName",message,kind,CASE WHEN location_name IS NULL THEN NULL ELSE json_build_object('name',location_name,'address',location_address,'selfReported',true) END AS location FROM assistance_items WHERE workspace_id=$1 AND id=$2 AND claimant_id=$3 AND lease_until>now() AND state='claimed' AND shelter_id=$4 AND assistance AND actionable AND NOT resident_sensitive AND NOT request_sensitive`,
          [a.workspaceId, req.params.id, a.id, a.shelterId],
        )
      ).rows[0],
    );
    res.json(r);
  });
  for (const action of ["claim", "release", "presented"])
    app.post(
      `/api/staff/assistance/:id/${action}`,
      mutation(config, staff, async (req, c, a) => {
        const t = found(
          (
            await c.query(
              `SELECT * FROM assistance_items WHERE workspace_id=$1 AND id=$2 AND shelter_id=$3`,
              [a.workspaceId, req.params.id, a.shelterId],
            )
          ).rows[0],
        );
        const active =
          t.state === "claimed" &&
          new Date(t.lease_until).getTime() > Date.now();
        if (
          !t.assistance ||
          !t.actionable ||
          t.resident_sensitive ||
          t.request_sensitive ||
          !["pending", "claimed"].includes(t.state)
        )
          throw new HttpError(
            409,
            "This delivery task is no longer actionable.",
          );
        if (action === "claim") {
          if (active && t.claimant_id !== a.id)
            throw new HttpError(
              409,
              "Another volunteer is assisting this resident.",
            );
          await c.query(
            "UPDATE assistance_tasks SET state='claimed',claimant_id=$2,lease_until=now()+interval '10 minutes' WHERE id=$1",
            [t.id, a.id],
          );
        } else {
          if (!active || t.claimant_id !== a.id)
            throw new HttpError(409, "Claim this task before continuing.");
          await c.query(
            "UPDATE assistance_tasks SET state=$2,claimant_id=null,lease_until=null WHERE id=$1",
            [t.id, action === "release" ? "pending" : "presented"],
          );
        }
        return { id: t.id, saved: true };
      }),
    );
  app.get("/api/staff/safeguarding", async (req, res) => {
    const a = requireActor(req, ["safeguarding"]);
    res.json(
      (
        await config.pool.query(
          "SELECT id,reason,acknowledged FROM safeguarding_cases WHERE workspace_id=$1 AND assigned_to=$2 ORDER BY id",
          [a.workspaceId, a.id],
        )
      ).rows,
    );
  });
  app.post(
    "/api/staff/safeguarding/:id/acknowledge",
    mutation(config, ["safeguarding"], async (req, c, a) => {
      found(
        (
          await c.query(
            "UPDATE safeguarding_cases SET acknowledged=true WHERE workspace_id=$1 AND assigned_to=$2 AND id=$3 RETURNING id",
            [a.workspaceId, a.id, req.params.id],
          )
        ).rows[0],
      );
      return { saved: true };
    }),
  );
}
