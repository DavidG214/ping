import { randomUUID, randomBytes } from "node:crypto";
import type pg from "pg";
import { code, hashCredential } from "../server/security";
export async function seedWorkspace(
  client: pg.PoolClient,
  pepper: string,
  hours = 24,
) {
  const id = randomUUID();
  await client.query(
    "INSERT INTO workspaces(id,expires_at) VALUES($1,now()+$2*interval '1 hour')",
    [id, hours],
  );
  const staff: Record<string, string> = {};
  const unusedPassword = await hashCredential(
    randomBytes(32).toString("hex"),
    pepper,
  );
  for (const key of ["A", "B", "C", "safeguarding"]) {
    const staffId = randomUUID();
    staff[key] = staffId;
    await client.query("INSERT INTO staff_accounts VALUES($1,$2,$3,$4,$5,$6)", [
      staffId,
      id,
      `${id}-${key}`,
      unusedPassword,
      key === "safeguarding" ? "A" : key,
      key === "safeguarding" ? key : "volunteer",
    ]);
  }
  const pinHash = await hashCredential("001234", pepper);
  const residents: Record<
    string,
    { id: string; code: string; pin: string; name: string; shelterId: string }
  > = {};
  for (const [key, name, shelter, age, assist, clue] of [
    ["alex", "Alex Rivera", "A", "30_44", false, "Grew up in Winter Park"],
    ["jordan", "Jordan Rivera", "B", "30_44", true, "Grew up in Winter Park"],
    ["sam", "Sam Chen", "B", "18_29", false, "Orange County College"],
    [
      "taylor",
      "Taylor Reed",
      "C",
      "45_64",
      false,
      "Staying with relatives; help desk affiliation only",
    ],
    ["casey", "Casey Morgan", "C", "unknown", true, "Age not established"],
  ] as const) {
    const residentId = randomUUID(),
      accountCode = code();
    await client.query(
      "INSERT INTO residents(id,workspace_id,name,age_band,assistance,shelter_id,clue,safeguarding) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [residentId, id, name, age, assist, shelter, clue, age === "unknown"],
    );
    await client.query("INSERT INTO resident_credentials VALUES($1,$2,$3)", [
      residentId,
      accountCode,
      pinHash,
    ]);
    await client.query("UPDATE residents SET demo_key=$2 WHERE id=$1", [
      residentId,
      key,
    ]);
    await client.query("INSERT INTO case_access VALUES($1,$2,$3)", [
      id,
      staff[shelter],
      residentId,
    ]);
    residents[key] = {
      id: residentId,
      code: accountCode,
      pin: "001234",
      name,
      shelterId: shelter,
    };
  }
  for (const [key, target, age, message] of [
    [
      "main",
      "Jordan Rivera",
      "30_44",
      "It's Alex. Please let me know you're safe. You decide what to share.",
    ],
    [
      "wrong",
      "Sam Rivera",
      "18_29",
      "We met at the Winter Park library. Is this the right person?",
    ],
    [
      "decline",
      "Taylor Reed",
      "45_64",
      "Could you let me know you are safe? No location needed.",
    ],
    [
      "safe",
      "Casey Morgan",
      "unknown",
      "Please contact the designated safeguarding team.",
    ],
  ]) {
    const requestId = randomUUID();
    await client.query(
      "INSERT INTO search_requests(id,workspace_id,requester_id,created_by,target_name,age_band,message,seeker_name,clue,safeguarding) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        requestId,
        id,
        residents.alex.id,
        staff.A,
        target,
        age,
        message,
        "Alex",
        "Grew up in Winter Park",
        key === "safe",
      ],
    );
    if (key === "wrong" || key === "decline")
      await client.query(
        "INSERT INTO deliveries(id,workspace_id,request_id,resident_id) VALUES($1,$2,$3,$4)",
        [
          randomUUID(),
          id,
          requestId,
          key === "wrong" ? residents.sam.id : residents.taylor.id,
        ],
      );
    if (key === "safe")
      await client.query(
        "INSERT INTO safeguarding_cases(id,workspace_id,resident_id,request_id,assigned_to,reason) VALUES($1,$2,$3,$4,$5,$6)",
        [
          randomUUID(),
          id,
          residents.casey.id,
          requestId,
          staff.safeguarding,
          "Age unknown: no ordinary delivery or disclosure.",
        ],
      );
  }
  return { id, residents };
}
