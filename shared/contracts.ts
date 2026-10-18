import { z } from "zod";
export const ageBand = z.enum([
  "under_18",
  "18_29",
  "30_44",
  "45_64",
  "65_plus",
  "unknown",
]);
export const text = (max: number) => z.string().trim().min(1).max(max);
export const optionalText = (max: number) =>
  z.string().trim().max(max).default("");
export const residentInput = z
  .object({
    name: text(80),
    ageBand,
    clue: optionalText(120),
    description: optionalText(240),
    language: text(60).default("English"),
    assistance: z.boolean(),
    safeguarding: z.boolean().default(false),
    pin: z.string().regex(/^\d{6}$/),
  })
  .strict();
export const requestInput = z
  .object({
    requesterId: z.uuid(),
    targetName: text(80),
    ageBand,
    clue: optionalText(120),
    description: optionalText(240),
    message: text(500),
    seekerName: text(80),
  })
  .strict();
export const loginInput = z
  .object({
    code: z.string().min(1).max(40),
    pin: z.string().regex(/^\d{6}$/),
    sharedDevice: z.boolean(),
    assistance: z.boolean(),
  })
  .strict();
export const replyInput = z
  .object({
    text: text(500),
    shelterId: z.enum(["A", "B", "C"]).nullable().default(null),
    atShelter: z.boolean().default(false),
  })
  .strict();
export const locationInput = z
  .object({ shelterId: z.enum(["A", "B", "C"]), atShelter: z.literal(true) })
  .strict();
export const sensitiveAge = (age: string) =>
  age === "under_18" || age === "unknown";
export type Shelter = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  demo: boolean;
};
export type Resident = {
  id: string;
  name: string;
  ageBand: string;
  clue: string;
  description: string;
  language: string;
  assistance: boolean;
  shelterId: string;
  safeguarding: boolean;
};
export type Actor = {
  id: string;
  workspaceId: string;
  role: "resident" | "volunteer" | "safeguarding";
  shelterId: string;
};
export type SessionInfo = {
  csrf: string;
  actor: Actor | null;
  demo: boolean;
  hasDemo: boolean;
  idleAt?: number;
  absoluteAt?: number;
  warningMs?: number;
  sharedDevice?: boolean;
};
