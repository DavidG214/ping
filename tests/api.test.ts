import "dotenv/config";
import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";
import request from "supertest";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { createApp } from "../server/app";
import { migrate } from "../db/migrate";
import { hashCredential, digest, signedPreview } from "../server/security";

const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
const app = createApp({
  pool,
  origin: "http://localhost:5173",
  secret: "test-session-secret-at-least-32-characters",
  pepper: "test-pepper-at-least-32-characters",
  demo: true,
  production: false,
});
beforeAll(async () => {
  if (
    new URL(process.env.TEST_DATABASE_URL || "postgres://invalid/").pathname !==
    "/ping_test"
  )
    throw new Error("Tests require dedicated ping_test database");
  await migrate(pool);
});
afterAll(async () => {
  await pool.end();
});
beforeEach(async () => {
  await pool.query("DELETE FROM login_attempts");
});
test("public directory uses persisted fictional shelters and no resident information", async () => {
  const response = await request(app).get("/api/shelters");
  expect(response.status).toBe(200);
  expect(response.body).toHaveLength(3);
  expect(Object.keys(response.body[0]).sort()).toEqual([
    "address",
    "demo",
    "id",
    "lat",
    "lng",
    "name",
  ]);
});
test("private routes require authentication", async () => {
  expect((await request(app).get("/api/me")).status).toBe(401);
  expect((await request(app).get("/api/staff/residents")).status).toBe(401);
});

async function browser() {
  const agent = request.agent(app);
  let csrf = "";
  async function refresh() {
    const r = await agent.get("/api/session");
    expect(r.status).toBe(200);
    csrf = r.body.csrf;
    return r.body;
  }
  await refresh();
  async function post(path: string, data: object = {}, key = randomUUID()) {
    const result = await agent
      .post("/api" + path)
      .set("Origin", "http://localhost:5173")
      .set("X-CSRF-Token", csrf)
      .set("Idempotency-Key", key)
      .send(data);
    if (result.body.csrf) csrf = result.body.csrf;
    return result;
  }
  const demo = await post("/demo/start");
  expect(demo.status).toBe(201);
  const guide = demo.body;
  async function role(role: string) {
    const r = await post("/demo/role", { role });
    expect(r.status).toBe(200);
    return r;
  }
  async function login(who: string, assistance = false, sharedDevice = true) {
    const r = await post("/auth/resident", {
      code: guide.residents[who].code,
      pin: "001234",
      assistance,
      sharedDevice,
    });
    expect(r.status).toBe(200);
    return r;
  }
  return { agent, post, guide, role, login, refresh };
}

async function newStaff(b: Awaited<ReturnType<typeof browser>>, shelter = "A") {
  const id = randomUUID(),
    username = randomUUID(),
    password = "test-only-password";
  await pool.query(
    "INSERT INTO staff_accounts VALUES($1,$2,$3,$4,$5,'volunteer')",
    [
      id,
      b.guide.id,
      username,
      await hashCredential(password, "test-pepper-at-least-32-characters"),
      shelter,
    ],
  );
  return { id, payload: { username, password, sharedDevice: true } };
}

test("successful staff sign-ins do not exhaust the account failure limit; failures and IP limits remain", async () => {
  const b = await browser(),
    s = await newStaff(b);
  for (let i = 0; i < 7; i++) {
    expect((await b.post("/auth/staff", s.payload)).status).toBe(200);
    await b.post("/auth/logout");
  }
  for (let i = 0; i < 5; i++)
    expect(
      (await b.post("/auth/staff", { ...s.payload, password: "wrong" })).status,
    ).toBe(401);
  expect((await b.post("/auth/staff", s.payload)).status).toBe(429);
  await pool.query("DELETE FROM login_attempts WHERE key=$1", [
    "staff:" + digest(s.payload.username, "test-pepper-at-least-32-characters"),
  ]);
  await pool.query(
    "UPDATE login_attempts SET attempts=100 WHERE key LIKE 'ip:%'",
  );
  expect((await b.post("/auth/staff", s.payload)).status).toBe(429);
});

for (const ending of ["release", "presented", "expiry", "opt-out"] as const) {
  test(`assistance ${ending} ends task access without granting alternate case or card access`, async () => {
    const b = await browser(),
      s = await newStaff(b);
    await b.login("alex", true);
    await b.role("B");
    const q = (await b.agent.get("/api/staff/matching-feed")).body.find(
      (r: any) => r.targetName === "Jordan Rivera",
    );
    expect(
      (
        await b.post(`/staff/requests/${q.id}/deliveries`, {
          residentId: b.guide.residents.jordan.id,
        })
      ).status,
    ).toBe(200);
    await b.login("jordan");
    const d = (await b.agent.get("/api/me/inbox")).body[0];
    const p = await b.post(`/deliveries/${d.id}/preview`, {
      text: "I'm safe",
      shelterId: null,
      atShelter: false,
    });
    expect(
      (await b.post(`/deliveries/${d.id}/reply`, { token: p.body.token }))
        .status,
    ).toBe(200);
    expect((await b.post("/auth/staff", s.payload)).status).toBe(200);
    const tasks = (await b.agent.get("/api/staff/assistance")).body;
    expect(tasks).toHaveLength(1);
    const taskPath = `/staff/assistance/${tasks[0].id}`;
    const residentPath = `/api/staff/residents/${b.guide.residents.alex.id}`;
    expect((await b.agent.get("/api" + taskPath)).status).toBe(404);
    expect((await b.post(taskPath + "/claim")).status).toBe(200);
    expect((await b.agent.get("/api" + taskPath)).body.message).toBe(
      "I'm safe",
    );
    expect((await b.agent.get(residentPath + "/card")).status).toBe(404);
    expect((await b.agent.get(residentPath + "/requests")).status).toBe(404);
    const otherStaff = await newStaff(b);
    expect((await b.post("/auth/staff", otherStaff.payload)).status).toBe(200);
    expect((await b.agent.get("/api" + taskPath)).status).toBe(404);
    expect((await b.post(taskPath + "/claim")).status).toBe(409);
    expect((await b.post("/auth/staff", s.payload)).status).toBe(200);
    if (ending === "expiry")
      await pool.query(
        "UPDATE assistance_tasks SET lease_until=now()-interval '1 second' WHERE id=$1",
        [tasks[0].id],
      );
    else if (ending === "opt-out")
      await b.post(`/staff/residents/${b.guide.residents.alex.id}/assistance`, {
        assistance: false,
      });
    else expect((await b.post(taskPath + "/" + ending)).status).toBe(200);
    expect((await b.agent.get("/api" + taskPath)).status).toBe(404);
    expect((await b.agent.get(residentPath + "/card")).status).toBe(404);
    expect((await b.agent.get(residentPath + "/requests")).status).toBe(404);
    expect(
      (
        await b.post("/staff/requests", {
          requesterId: b.guide.residents.alex.id,
          targetName: "Another person",
          ageBand: "30_44",
          message: "Hello",
          seekerName: "Alex",
        })
      ).status,
    ).toBe(404);
    // Explicit, audited case access remains available and independent.
    expect(
      (await b.post(`/staff/residents/${b.guide.residents.alex.id}/open-case`))
        .status,
    ).toBe(200);
    expect((await b.agent.get(residentPath + "/card")).status).toBe(200);
    expect((await b.agent.get(residentPath + "/requests")).status).toBe(200);
    await b.role("A");
    expect((await b.agent.get(residentPath + "/card")).status).toBe(200);
  });
}
test("private cross-shelter cycle reveals only an approved reply; location needs separate consent", async () => {
  const b = await browser();
  await b.login("alex");
  const before = (await b.agent.get("/api/me/requests")).body;
  await b.role("B");
  const feed = (await b.agent.get("/api/staff/matching-feed")).body;
  const target = feed.find((r: any) => r.targetName === "Jordan Rivera");
  expect(target).toBeTruthy();
  expect(JSON.stringify(feed)).not.toContain("requesterId");
  expect(JSON.stringify(feed)).not.toContain("message");
  const routed = await b.post(`/staff/requests/${target.id}/deliveries`, {
    residentId: b.guide.residents.jordan.id,
  });
  expect(routed.status).toBe(200);
  await b.login("alex");
  expect((await b.agent.get("/api/me/requests")).body).toEqual(before);
  await b.login("jordan", true);
  const inbox = (await b.agent.get("/api/me/inbox")).body;
  const delivery = inbox[0];
  const preview = await b.post(`/deliveries/${delivery.id}/preview`, {
    text: "I'm safe",
    shelterId: null,
    atShelter: false,
  });
  expect(preview.status).toBe(200);
  expect(preview.body.disclosure).toEqual({ text: "I'm safe", location: null });
  const key = randomUUID();
  const sent = await b.post(
    `/deliveries/${delivery.id}/reply`,
    { token: preview.body.token },
    key,
  );
  expect(sent.status).toBe(200);
  expect(
    (
      await b.post(
        `/deliveries/${delivery.id}/reply`,
        { token: preview.body.token },
        key,
      )
    ).body,
  ).toEqual(sent.body);
  await b.login("alex");
  const response = (await b.agent.get("/api/me/requests")).body.find(
    (r: any) => r.id === target.id,
  );
  expect(response.status).toBe("Response available");
  expect(response.response).toEqual({ text: "I'm safe", location: null });
  expect(JSON.stringify(response)).not.toMatch(
    /residentId|deliveryId|shelterId|readAt|Lantern/,
  );
  await b.login("jordan");
  expect(
    (
      await b.post(`/deliveries/${delivery.id}/location-preview`, {
        shelterId: "B",
        atShelter: false,
      })
    ).status,
  ).toBe(400);
  const location = await b.post(`/deliveries/${delivery.id}/location-preview`, {
    shelterId: "B",
    atShelter: true,
  });
  expect(location.status).toBe(200);
  expect(
    (
      await b.post(`/deliveries/${delivery.id}/location`, {
        token: location.body.token,
      })
    ).status,
  ).toBe(200);
  await b.login("alex");
  expect(
    (await b.agent.get("/api/me/requests")).body.find(
      (r: any) => r.id === target.id,
    ).response.location.name,
  ).toBe("Lantern Center");
});
test("wrong-person and silent decline stay private; rejected candidate cannot be rerouted", async () => {
  const b = await browser();
  await b.login("alex");
  const before = (await b.agent.get("/api/me/requests")).body;
  await b.login("sam");
  const d = (await b.agent.get("/api/me/inbox")).body[0];
  expect(
    (await b.post(`/deliveries/${d.id}/decision`, { decision: "wrong_person" }))
      .status,
  ).toBe(200);
  await b.login("taylor");
  const t = (await b.agent.get("/api/me/inbox")).body[0];
  expect(
    (await b.post(`/deliveries/${t.id}/decision`, { decision: "decline" }))
      .status,
  ).toBe(200);
  await b.login("alex");
  expect((await b.agent.get("/api/me/requests")).body).toEqual(before);
  await b.role("B");
  const feed = (await b.agent.get("/api/staff/matching-feed")).body;
  const r = feed.find((r: any) => r.targetName === "Sam Rivera");
  expect(
    (
      await b.post(`/staff/requests/${r.id}/deliveries`, {
        residentId: b.guide.residents.sam.id,
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await b.post(`/staff/requests/${r.id}/deliveries`, {
        residentId: b.guide.residents.jordan.id,
      })
    ).status,
  ).toBe(200);
});
test("server enforces resident, shelter, workspace, CSRF and safeguarding boundaries", async () => {
  const b = await browser(),
    other = await browser();
  await b.role("A");
  const locals = (await b.agent.get("/api/staff/residents")).body;
  expect(locals).toHaveLength(1);
  expect(locals[0].name).toBe("Alex Rivera");
  expect(
    (await b.agent.get(`/api/staff/residents/${b.guide.residents.jordan.id}`))
      .status,
  ).toBe(404);
  expect(
    (
      await b.post(
        `/staff/residents/${other.guide.residents.alex.id}/assistance`,
        { assistance: true },
      )
    ).status,
  ).toBe(404);
  await b.login("sam");
  const d = (await b.agent.get("/api/me/inbox")).body[0];
  await b.login("alex");
  expect(
    (await b.post(`/deliveries/${d.id}/decision`, { decision: "decline" }))
      .status,
  ).toBe(404);
  expect(
    (await b.agent.post("/api/me/preferences").send({ assistance: true }))
      .status,
  ).toBe(403);
  await b.role("C");
  const feed = (await b.agent.get("/api/staff/matching-feed")).body;
  expect(feed.some((r: any) => r.targetName === "Casey Morgan")).toBe(false);
  expect(
    (
      await b.post(`/staff/requests/${feed[0].id}/deliveries`, {
        residentId: b.guide.residents.casey.id,
      })
    ).status,
  ).toBe(409);
  await b.role("safeguarding");
  expect((await b.agent.get("/api/staff/safeguarding")).body).toHaveLength(1);
});
test("assistance persists, claim cancellation is enforced, and login asks independent questions", async () => {
  const b = await browser();
  await b.role("B");
  const feed = (await b.agent.get("/api/staff/matching-feed")).body;
  await b.post(
    `/staff/requests/${feed.find((r: any) => r.targetName === "Jordan Rivera").id}/deliveries`,
    { residentId: b.guide.residents.jordan.id },
  );
  const tasks = (await b.agent.get("/api/staff/assistance")).body;
  expect(tasks).toHaveLength(1);
  expect((await b.post(`/staff/assistance/${tasks[0].id}/claim`)).status).toBe(
    200,
  );
  expect(
    (
      await b.post(
        `/staff/residents/${b.guide.residents.jordan.id}/assistance`,
        { assistance: false },
      )
    ).status,
  ).toBe(200);
  expect(
    (await b.post(`/staff/assistance/${tasks[0].id}/presented`)).status,
  ).toBe(409);
  await b.login("jordan", true, false);
  await b.post("/auth/logout");
  const persisted = await pool.query(
    "SELECT assistance FROM residents WHERE id=$1",
    [b.guide.residents.jordan.id],
  );
  expect(persisted.rows[0].assistance).toBe(true);
  expect(
    (
      await b.post("/auth/resident", {
        code: b.guide.residents.jordan.code,
        pin: "001234",
      })
    ).status,
  ).toBe(400);
});
test("invalid login is generic and persistently throttled", async () => {
  const b = await browser();
  const payload = {
    code: b.guide.residents.alex.code,
    pin: "999999",
    sharedDevice: true,
    assistance: false,
  };
  const unknown = await b.post("/auth/resident", {
    ...payload,
    code: randomUUID(),
  });
  const wrong = await b.post("/auth/resident", payload);
  expect(wrong.status).toBe(401);
  expect(wrong.body).toEqual(unknown.body);
  for (let i = 0; i < 4; i++) await b.post("/auth/resident", payload);
  expect((await b.post("/auth/resident", payload)).status).toBe(429);
});

test("registration and request retries are atomic, credentials stay out of profiles, and unknown-age intake is restricted", async () => {
  const b = await browser();
  await b.role("A");
  const key = randomUUID();
  const p = {
    name: "Fictional Newcomer",
    ageBand: "unknown",
    clue: "Winter Park",
    description: "",
    language: "Spanish",
    assistance: true,
    pin: "001234",
  };
  const first = await b.post("/staff/residents", p, key);
  expect(first.status).toBe(200);
  expect(first.body.safeguarding).toBe(true);
  expect((await b.post("/staff/residents", p, key)).body).toEqual(first.body);
  expect(
    (await b.post("/staff/residents", { ...p, name: "Changed" }, key)).status,
  ).toBe(409);
  const profiles = (await b.agent.get("/api/staff/residents")).body;
  expect(profiles.filter((r: any) => r.name === p.name)).toHaveLength(1);
  expect(JSON.stringify(profiles)).not.toMatch(/pin|code|hash/i);
  const req = {
    requesterId: first.body.id,
    targetName: "Fictional Adult",
    ageBand: "30_44",
    clue: "",
    description: "",
    message: "Hello",
    seekerName: "Newcomer",
  };
  const created = await b.post("/staff/requests", req);
  expect(created.status).toBe(200);
  await b.role("B");
  expect(
    (await b.agent.get("/api/staff/matching-feed")).body.some(
      (r: any) => r.id === created.body.id,
    ),
  ).toBe(false);
  expect(
    (
      await b.post(`/staff/requests/${created.body.id}/deliveries`, {
        residentId: b.guide.residents.jordan.id,
      })
    ).status,
  ).toBe(409);
});
test("only one candidate can be routed concurrently, and only the assistance claimant can open the message", async () => {
  const b = await browser();
  await b.login("sam", true);
  await b.role("B");
  const q = (await b.agent.get("/api/staff/matching-feed")).body.find(
    (r: any) => r.targetName === "Jordan Rivera",
  );
  const results = await Promise.all([
    b.post(`/staff/requests/${q.id}/deliveries`, {
      residentId: b.guide.residents.jordan.id,
    }),
    b.post(`/staff/requests/${q.id}/deliveries`, {
      residentId: b.guide.residents.sam.id,
    }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  const tasks = (await b.agent.get("/api/staff/assistance")).body;
  // Sam's seeded incoming ping plus the newly routed request, whichever candidate wins.
  expect(tasks).toHaveLength(2);
  {
    expect(
      (await b.agent.get("/api/staff/assistance/" + tasks[0].id)).status,
    ).toBe(404);
    await b.post("/staff/assistance/" + tasks[0].id + "/claim");
    expect(
      (await b.agent.get("/api/staff/assistance/" + tasks[0].id)).status,
    ).toBe(200);
    await b.post("/staff/assistance/" + tasks[0].id + "/release");
    expect(
      (await b.agent.get("/api/staff/assistance/" + tasks[0].id)).status,
    ).toBe(404);
  }
});
test("logout revokes the previous cookie and server idle expiry denies direct APIs", async () => {
  const b = await browser();
  const login = await b.login("alex");
  const cookie = login.headers["set-cookie"][0].split(";")[0];
  await b.post("/auth/logout");
  expect((await request(app).get("/api/me").set("Cookie", cookie)).status).toBe(
    401,
  );
  await b.login("alex");
  await pool.query(
    `UPDATE sessions SET sess=jsonb_set(sess::jsonb,'{idleAt}','0')::json WHERE sess->'actor'->>'id'=$1`,
    [b.guide.residents.alex.id],
  );
  expect((await b.agent.get("/api/me")).status).toBe(401);
});
test("reset invalidates only its own workspace; demo helpers are unavailable when disabled", async () => {
  const b = await browser(),
    other = await browser();
  await b.login("alex");
  await other.login("alex");
  await b.post("/demo/reset");
  expect((await b.agent.get("/api/me")).status).toBe(401);
  expect((await other.agent.get("/api/me")).status).toBe(200);
  const locked = createApp({
    pool,
    origin: "http://localhost:5173",
    secret: "another-long-session-secret-at-least-32",
    pepper: "another-long-pepper-at-least-32",
    demo: false,
    production: false,
  });
  const agent = request.agent(locked);
  const s = await agent.get("/api/session");
  expect(
    (
      await agent
        .post("/api/demo/start")
        .set("Origin", "http://localhost:5173")
        .set("X-CSRF-Token", s.body.csrf)
        .send({})
    ).status,
  ).toBe(404);
});
test("new residents with seed names are never exposed as demo credentials", async () => {
  const b = await browser();
  await b.role("A");
  await b.post("/staff/residents", {
    name: "Alex Rivera",
    ageBand: "18_29",
    language: "English",
    assistance: false,
    pin: "012345",
  });
  const guide = (await b.agent.get("/api/demo/guide")).body;
  expect(guide.residents.alex.id).toBe(b.guide.residents.alex.id);
  const count = await pool.query(
    "SELECT count(*) FROM resident_credentials c JOIN residents r ON r.id=c.resident_id WHERE r.workspace_id=$1 AND r.name=$2",
    [b.guide.id, "Alex Rivera"],
  );
  expect(Number(count.rows[0].count)).toBe(2);
});

test("approved replies queue assistance for the requester and expose only the approved reply to its claimant", async () => {
  const b = await browser();
  await b.login("alex", true);
  await b.role("B");
  const q = (await b.agent.get("/api/staff/matching-feed")).body.find(
    (r: any) => r.targetName === "Jordan Rivera",
  );
  await b.post(`/staff/requests/${q.id}/deliveries`, {
    residentId: b.guide.residents.jordan.id,
  });
  await b.login("jordan");
  const d = (await b.agent.get("/api/me/inbox")).body[0];
  const p = await b.post(`/deliveries/${d.id}/preview`, {
    text: "I'm safe",
    shelterId: null,
    atShelter: false,
  });
  await b.post(`/deliveries/${d.id}/reply`, { token: p.body.token });
  await b.role("A");
  const tasks = (await b.agent.get("/api/staff/assistance")).body;
  expect(tasks).toHaveLength(1);
  expect(tasks[0].name).toBe("Alex Rivera");
  expect(
    (await b.agent.get("/api/staff/assistance/" + tasks[0].id)).status,
  ).toBe(404);
  await b.post("/staff/assistance/" + tasks[0].id + "/claim");
  const content = (await b.agent.get("/api/staff/assistance/" + tasks[0].id))
    .body;
  expect(content.message).toBe("I'm safe");
  expect(JSON.stringify(content)).not.toMatch(
    /Lantern|residentId|shelterId|deliveryId/,
  );
  await b.post("/staff/assistance/" + tasks[0].id + "/presented");
  expect((await b.agent.get("/api/staff/assistance")).body).toHaveLength(0);
  await b.login("jordan");
  const location = await b.post(`/deliveries/${d.id}/location-preview`, {
    shelterId: "B",
    atShelter: true,
  });
  expect(location.status).toBe(200);
  expect(
    (
      await b.post(`/deliveries/${d.id}/location`, {
        token: location.body.token,
      })
    ).status,
  ).toBe(200);
  await b.role("A");
  expect((await b.agent.get("/api/staff/assistance")).body).toHaveLength(1);
  await b.post("/staff/assistance/" + tasks[0].id + "/claim");
  expect(
    (await b.agent.get("/api/staff/assistance/" + tasks[0].id)).body.location
      .name,
  ).toBe("Lantern Center");
  await b.post(`/staff/residents/${b.guide.residents.alex.id}/assistance`, {
    assistance: false,
  });
  expect(
    (await b.agent.get("/api/staff/assistance/" + tasks[0].id)).status,
  ).toBe(404);
});

test("a late session-store save cannot resurrect a session revoked by logout", async () => {
  const b = await browser();
  const login = await b.login("alex");
  const cookie = login.headers["set-cookie"][0].split(";")[0];
  const old = (
    await pool.query(`SELECT * FROM sessions WHERE sess->'actor'->>'id'=$1`, [
      b.guide.residents.alex.id,
    ])
  ).rows[0];
  await b.post("/auth/logout");
  // Reproduce connect-pg-simple's delayed UPSERT after a concurrent request loaded the old session.
  await pool.query(
    "INSERT INTO sessions(sid,sess,expire) VALUES($1,$2,$3) ON CONFLICT(sid) DO UPDATE SET sess=excluded.sess,expire=excluded.expire",
    [old.sid, old.sess, old.expire],
  );
  expect((await request(app).get("/api/me").set("Cookie", cookie)).status).toBe(
    401,
  );
});

test("preview tokens reject tampering, expired approvals, wrong action and different resident", async () => {
  const b = await browser();
  await b.login("sam");
  const d = (await b.agent.get("/api/me/inbox")).body[0];
  const p = await b.post(`/deliveries/${d.id}/preview`, {
    text: "Only this exact text",
    shelterId: null,
    atShelter: false,
  });
  expect(p.status).toBe(200);
  const [encoded, signature] = p.body.token.split(".");
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
  const changed =
    Buffer.from(
      JSON.stringify({ ...payload, text: "Changed without approval" }),
    ).toString("base64url") +
    "." +
    signature;
  expect(
    (await b.post(`/deliveries/${d.id}/reply`, { token: changed })).status,
  ).toBe(400);
  const expired = signedPreview(
    { ...payload, expires: Date.now() - 1 },
    "test-session-secret-at-least-32-characters",
  );
  expect(
    (await b.post(`/deliveries/${d.id}/reply`, { token: expired })).status,
  ).toBe(409);
  expect(
    (await b.post(`/deliveries/${d.id}/location`, { token: p.body.token }))
      .status,
  ).toBe(409);
  await b.login("alex");
  expect(
    (await b.post(`/deliveries/${d.id}/reply`, { token: p.body.token })).status,
  ).toBe(409);
  await b.login("sam");
  expect((await b.agent.get("/api/me/inbox")).body[0].response).toBeNull();
  expect(
    (await b.post(`/deliveries/${d.id}/reply`, { token: p.body.token })).status,
  ).toBe(200);
  expect((await b.agent.get("/api/me/inbox")).body[0].response.text).toBe(
    "Only this exact text",
  );
});

test("shelter approval requires current presence, is scoped to one request and cannot be changed after sharing", async () => {
  const b = await browser();
  await b.login("sam");
  const d = (await b.agent.get("/api/me/inbox")).body[0];
  expect(
    (
      await b.post(`/deliveries/${d.id}/preview`, {
        text: "Hello",
        shelterId: "B",
        atShelter: false,
      })
    ).status,
  ).toBe(400);
  const p = await b.post(`/deliveries/${d.id}/preview`, {
    text: "Hello",
    shelterId: "B",
    atShelter: true,
  });
  expect(p.body.disclosure.location).toEqual({
    name: "Lantern Center",
    address: "Demo help desk B · Orange County, FL",
    selfReported: true,
  });
  expect(
    (await b.post(`/deliveries/${d.id}/reply`, { token: p.body.token })).status,
  ).toBe(200);
  expect(
    (
      await b.post(`/deliveries/${d.id}/location-preview`, {
        shelterId: "A",
        atShelter: true,
      })
    ).status,
  ).toBe(409);
  expect(
    (await b.post(`/deliveries/${d.id}/preview`, { text: "Second reply" }))
      .status,
  ).toBe(409);
  await b.login("alex");
  const requests = (await b.agent.get("/api/me/requests")).body;
  expect(requests.filter((r: any) => r.response?.location)).toHaveLength(1);
});

test("safeguarding acknowledgement is assigned-role only and never authorizes ordinary delivery", async () => {
  const b = await browser(),
    other = await browser();
  await b.role("safeguarding");
  const cases = (await b.agent.get("/api/staff/safeguarding")).body;
  expect(cases).toHaveLength(1);
  // Safeguarding staff retain existing own-shelter staff permissions.
  expect(
    (await b.agent.get("/api/staff/residents")).body.map((r: any) => r.name),
  ).toEqual(["Alex Rivera"]);
  await b.role("A");
  expect(
    (await b.post(`/staff/safeguarding/${cases[0].id}/acknowledge`)).status,
  ).toBe(404);
  await other.role("safeguarding");
  expect(
    (await other.post(`/staff/safeguarding/${cases[0].id}/acknowledge`)).status,
  ).toBe(404);
  await b.role("safeguarding");
  const key = randomUUID();
  expect(
    (await b.post(`/staff/safeguarding/${cases[0].id}/acknowledge`, {}, key))
      .status,
  ).toBe(200);
  expect(
    (await b.post(`/staff/safeguarding/${cases[0].id}/acknowledge`, {}, key))
      .status,
  ).toBe(200);
  expect(
    (await b.agent.get("/api/staff/safeguarding")).body[0].acknowledged,
  ).toBe(true);
  await b.role("C");
  const q = (await b.agent.get("/api/staff/matching-feed")).body[0];
  expect(
    (
      await b.post(`/staff/requests/${q.id}/deliveries`, {
        residentId: b.guide.residents.casey.id,
      })
    ).status,
  ).toBe(409);
  await b.login("casey", true);
  expect((await b.agent.get("/api/me")).body.safeguarding).toBe(true);
  expect((await b.agent.get("/api/me/inbox")).body).toEqual([]);
});

test("database-backed sessions survive application recreation and retain private cache headers", async () => {
  const b = await browser(),
    login = await b.login("sam");
  const cookie = login.headers["set-cookie"][0].split(";")[0];
  const restarted = createApp({
    pool,
    origin: "http://localhost:5173",
    secret: "test-session-secret-at-least-32-characters",
    pepper: "test-pepper-at-least-32-characters",
    demo: true,
    production: false,
  });
  const me = await request(restarted).get("/api/me").set("Cookie", cookie);
  expect(me.status).toBe(200);
  expect(me.body.id).toBe(b.guide.residents.sam.id);
  expect(me.headers["cache-control"]).toBe("no-store");
  expect(
    (await request(restarted).get("/api/me/inbox").set("Cookie", cookie)).body,
  ).toHaveLength(1);
});

test("new shelter disclosure invalidates an open reply-assistance claim so it cannot be marked presented unseen", async () => {
  const b = await browser();
  await b.login("alex", true);
  await b.login("sam");
  const d = (await b.agent.get("/api/me/inbox")).body[0];
  const preview = await b.post(`/deliveries/${d.id}/preview`, {
    text: "I'm safe",
  });
  expect(
    (await b.post(`/deliveries/${d.id}/reply`, { token: preview.body.token }))
      .status,
  ).toBe(200);
  await b.role("A");
  const task = (await b.agent.get("/api/staff/assistance")).body[0];
  expect((await b.post(`/staff/assistance/${task.id}/claim`)).status).toBe(200);
  expect(
    (await b.agent.get(`/api/staff/assistance/${task.id}`)).body.location,
  ).toBeNull();
  await b.login("sam");
  const location = await b.post(`/deliveries/${d.id}/location-preview`, {
    shelterId: "B",
    atShelter: true,
  });
  expect(
    (
      await b.post(`/deliveries/${d.id}/location`, {
        token: location.body.token,
      })
    ).status,
  ).toBe(200);
  await b.role("A");
  expect((await b.post(`/staff/assistance/${task.id}/presented`)).status).toBe(
    409,
  );
  expect((await b.agent.get(`/api/staff/assistance/${task.id}`)).status).toBe(
    404,
  );
  expect((await b.post(`/staff/assistance/${task.id}/claim`)).status).toBe(200);
  expect(
    (await b.agent.get(`/api/staff/assistance/${task.id}`)).body.location.name,
  ).toBe("Lantern Center");
  expect((await b.post(`/staff/assistance/${task.id}/presented`)).status).toBe(
    200,
  );
});
