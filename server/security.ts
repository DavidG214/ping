import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
export const code = () =>
  Array.from(
    randomBytes(20),
    (n) => "0123456789ABCDEFGHJKMNPQRSTVWXYZ"[n & 31],
  ).join("");
export const normalizeCode = (value: string) =>
  value.toUpperCase().replace(/[\s-]/g, "");
export const digest = (value: string, key: string) =>
  createHmac("sha256", key).update(value).digest("hex");
export const hashCredential = (value: string, pepper: string) =>
  argon2.hash(digest(value, pepper), {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
export const verifyCredential = (hash: string, value: string, pepper: string) =>
  argon2.verify(hash, digest(value, pepper));
export function signedPreview(payload: object, secret: string) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${digest(data, secret)}`;
}
export function readPreview(token: string, secret: string) {
  const [data, sig] = token.split(".");
  const expected = digest(data || "", secret);
  if (
    !sig ||
    sig.length !== expected.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  )
    throw new Error("Invalid preview");
  return JSON.parse(Buffer.from(data, "base64url").toString());
}
