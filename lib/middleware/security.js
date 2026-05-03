/**
 * Security Middleware
 * Server-only HMAC request signing, CSRF helper signals, and replay protection.
 */

import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { log } from "../logger.js";

const REQUEST_SIGNATURE_HEADER = "x-signature";
const REQUEST_TIMESTAMP_HEADER = "x-timestamp";
const REQUEST_NONCE_HEADER = "x-nonce";
const CSRF_TOKEN_HEADER = "x-csrf-token";
const MAX_REQUEST_AGE_MS = 5 * 60 * 1000;

let loggedTestBypass = false;

function getSecurityMode() {
  return process.env.SECURITY_MODE || (process.env.NODE_ENV === "test" ? "test" : "strict");
}

function logTestBypassOnce() {
  if (!loggedTestBypass) {
    loggedTestBypass = true;
    log("warn", "SECURITY_BYPASS_FOR_TEST_ENV", { mode: getSecurityMode() });
  }
}

function timingSafeHexCompare(actual, expected) {
  const actualBuffer = Buffer.from(String(actual || ""), "hex");
  const expectedBuffer = Buffer.from(String(expected || ""), "hex");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function signRequestPayload({ secret, method, path, body, timestamp, nonce }) {
  return createHmac("sha256", secret)
    .update(`${method}${path}${body}${timestamp}${nonce}`)
    .digest("hex");
}

export function createRequestSigningMiddleware(redis) {
  return async (req, res, next) => {
    if (req.method !== "POST" || !["/api/ask", "/api/ask/stream"].includes(req.path)) {
      return next();
    }

    if (getSecurityMode() === "test") {
      logTestBypassOnce();
      return next();
    }

    const secret = process.env.SIGNING_SECRET;
    if (!secret) {
      return res.status(500).json({ success: false, data: null, errorType: "SIGNING_SECRET_MISSING", statusCode: 500, requestId: req.requestId });
    }

    const signature = req.headers[REQUEST_SIGNATURE_HEADER];
    const timestamp = req.headers[REQUEST_TIMESTAMP_HEADER];
    const nonce = req.headers[REQUEST_NONCE_HEADER];

    if (!signature || !timestamp || !nonce) {
      log("warn", "Missing security headers", { signature: !!signature, timestamp: !!timestamp, nonce: !!nonce });
      return res.status(401).json({ success: false, data: null, errorType: "MISSING_SIGNATURE", statusCode: 401, requestId: req.requestId });
    }

    const requestAge = Date.now() - Number(timestamp);
    if (!Number.isFinite(requestAge) || requestAge < 0 || requestAge > MAX_REQUEST_AGE_MS) {
      return res.status(401).json({ success: false, data: null, errorType: "TIMESTAMP_EXPIRED", statusCode: 401, requestId: req.requestId });
    }

    const nonceKey = `nonce:${nonce}`;
    const nonceClaimed = await redis.set(nonceKey, req.requestId || randomUUID(), "NX", "PX", MAX_REQUEST_AGE_MS);
    if (!nonceClaimed) {
      return res.status(401).json({ success: false, data: null, errorType: "REPLAY_DETECTED", statusCode: 401, requestId: req.requestId });
    }

    const expectedSignature = signRequestPayload({
      secret,
      method: req.method,
      path: req.path,
      body: JSON.stringify(req.body || {}),
      timestamp: String(timestamp),
      nonce: String(nonce)
    });

    if (!timingSafeHexCompare(signature, expectedSignature)) {
      return res.status(401).json({ success: false, data: null, errorType: "INVALID_SIGNATURE", statusCode: 401, requestId: req.requestId });
    }

    return next();
  };
}

export function csrfTokenHeaderName() {
  return CSRF_TOKEN_HEADER;
}
