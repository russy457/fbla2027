/**
 * letterIds.ts
 * Letter identifiers (SPEC#dm-letters, SPEC 5.6):
 *   letterId   = first 32 hex of SHA-256("uid|scopeKey|requestNonce"), so a
 *                retried click (same nonce) finds the same letter.
 *   verifyCode = 128 random bits as 26-character base32; it is the public
 *                /verify id, so it must be unguessable, unlike letterId.
 */
import { createHash, randomBytes } from "node:crypto";
import { base32Encode } from "@fbla/shared";

const LETTER_ID_HEX_LENGTH = 32;
const VERIFY_CODE_BYTES = 16;

export const letterIdFor = (uid: string, scopeKey: string, requestNonce: string): string =>
  createHash("sha256").update(`${uid}|${scopeKey}|${requestNonce}`).digest("hex").slice(0, LETTER_ID_HEX_LENGTH);

export const newVerifyCode = (): string => base32Encode(randomBytes(VERIFY_CODE_BYTES));
