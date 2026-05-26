import { createHash } from "node:crypto";
import { decodeProtectedHeader, importJWK, jwtVerify, type JWK } from "jose";

import { plaid } from "@/lib/plaid";

/**
 * Verifies a Plaid webhook per their documented JWT flow:
 *   1. Decode JWT header to extract the `kid` (key id)
 *   2. Look up the EC public key via plaid.webhookVerificationKeyGet(kid)
 *   3. Verify JWT signature (ES256) AND maxTokenAge (5 minutes)
 *   4. Compare body SHA-256 against the JWT's request_body_sha256 claim
 *
 * Per Plaid docs:
 * https://plaid.com/docs/api/webhooks/webhook-verification/
 *
 * Returns true ONLY if every step passes. False on any failure (missing
 * header, expired token, signature mismatch, body hash mismatch). Caller
 * should reject the webhook with 401 on false.
 *
 * Keys are cached in-process by kid. Plaid rotates keys infrequently and
 * publishes new ones via the same endpoint, so we re-fetch on first miss.
 */

const keyCache = new Map<string, CryptoKey | Uint8Array>();

async function getVerificationKey(kid: string) {
  const cached = keyCache.get(kid);
  if (cached) return cached;

  const res = await plaid().webhookVerificationKeyGet({ key_id: kid });
  const jwkRaw = res.data.key;
  // Plaid returns the JWK as an object with kty/alg/use/etc. jose's
  // importJWK takes that directly.
  const key = await importJWK(jwkRaw as unknown as JWK, "ES256");
  keyCache.set(kid, key);
  return key;
}

export async function verifyPlaidWebhook(
  jwtToken: string | null,
  rawBody: string
): Promise<boolean> {
  if (!jwtToken) return false;

  let kid: string;
  try {
    const header = decodeProtectedHeader(jwtToken);
    if (!header.kid) return false;
    kid = header.kid;
  } catch (e) {
    console.warn("[plaid webhook] bad JWT header", e);
    return false;
  }

  let key;
  try {
    key = await getVerificationKey(kid);
  } catch (e) {
    console.warn("[plaid webhook] failed to fetch verification key", e);
    return false;
  }

  try {
    const { payload } = await jwtVerify(jwtToken, key, {
      algorithms: ["ES256"],
      maxTokenAge: "5 minutes",
    });

    const expectedHash = createHash("sha256").update(rawBody).digest("hex");
    if (payload.request_body_sha256 !== expectedHash) {
      console.warn("[plaid webhook] body hash mismatch", {
        expected: expectedHash,
        claimed: payload.request_body_sha256,
      });
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[plaid webhook] JWT verify failed", e);
    return false;
  }
}
