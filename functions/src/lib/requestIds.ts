/**
 * requestIds.ts
 * Deterministic ids for create-type ops (SPEC 5.1): an id derived from the
 * caller and the client's requestNonce means a retried click lands on the
 * same document instead of creating a twin. The hash hides the nonce and
 * keeps ids path-safe (hex only).
 */
import { createHash } from "node:crypto";

const DEFAULT_HEX_LENGTH = 24;

/** First `length` hex characters of SHA-256 over the parts joined by "|". */
export const hashId = (parts: readonly string[], length: number = DEFAULT_HEX_LENGTH): string =>
  createHash("sha256").update(parts.join("|")).digest("hex").slice(0, length);

/** Full SHA-256 hex of one string (invite ids are the hash of the code, SPEC 3.5). */
export const sha256Hex = (value: string): string => createHash("sha256").update(value).digest("hex");
