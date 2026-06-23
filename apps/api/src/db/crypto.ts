// ENCRYPT-NATAL-V1 — application-layer encryption for sensitive natal_data columns.
//
// AES-256-GCM. Each value is encrypted with a fresh random 96-bit IV; the
// authentication tag is stored alongside so any tampering/wrong key is detected
// on decrypt (GCM throws). Storage format (text column):
//
//     v1:<base64( iv[12] | tag[16] | ciphertext )>
//
// Threat model: this protects data at rest against a stolen DB dump / backup,
// a leaked DATABASE_URL, or read-only SQL injection — the key lives in the API
// process env, NOT in Postgres. It is NOT zero-knowledge (a full VPS compromise
// that also reads the key can decrypt). The real zero-knowledge design is V2.
//
// Backward compatibility: decrypt() returns any value WITHOUT the "v1:" prefix
// unchanged. This lets the column carry legacy plaintext during the one-time
// backfill (init-natal-encryption.ts) with zero downtime.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "v1:";
const IV_LEN = 12; // GCM standard nonce length
const TAG_LEN = 16;

let cachedKey: Buffer | null = null;

// Derive a stable 32-byte key from DATA_ENCRYPTION_KEY. sha256 lets any
// sufficiently-strong secret (e.g. `openssl rand -base64 32`) work while always
// yielding exactly 256 bits. Presence/length is fail-fast'd at boot via
// requireSecret("DATA_ENCRYPTION_KEY", 32) in index.ts; this is the last line
// of defence if something reads a value before that check.
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env["DATA_ENCRYPTION_KEY"];
  if (!secret || secret.trim().length < 32) {
    throw new Error(
      "DATA_ENCRYPTION_KEY is missing or too short (min 32 chars) — cannot encrypt/decrypt natal_data.",
    );
  }
  cachedKey = createHash("sha256").update(secret.trim(), "utf8").digest();
  return cachedKey;
}

export function isEncrypted(value: string): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptValue(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptValue(stored: string): string {
  // Legacy plaintext (pre-backfill) or already-decrypted: pass through.
  if (!isEncrypted(stored)) return stored;
  const buf = Buffer.from(stored.slice(PREFIX.length), "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
