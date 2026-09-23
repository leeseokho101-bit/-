import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const PREFIX = "scrypt";

/** 비밀번호 해시: "scrypt$<salt(base64)>$<hash(base64)>" — 평문은 저장하지 않는다. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password.normalize("NFKC"), salt, KEY_LENGTH);
  return `${PREFIX}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [prefix, saltB64, hashB64] = stored.split("$");
  if (prefix !== PREFIX || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scryptAsync(
    password.normalize("NFKC"),
    Buffer.from(saltB64, "base64"),
    expected.length,
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
