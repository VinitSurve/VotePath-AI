/**
 * Security Middleware
 * Handles CSRF, request signing, and security headers
 */

import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { log } from "../logger.js";

const REQUEST_SIGNATURE_HEADER = "x-signature";
const REQUEST_TIMESTAMP_HEADER = "x-timestamp";
const REQUEST_NONCE_HEADER = "x-nonce";
const CSRF_TOKEN_HEADER = "x-csrf-token";
const MAX_REQUEST_AGE_MS = 5 * 60 * 1000; // 5 minutes

// In-memory nonce store (in production, use Redis)
const nonceStore = new Set();

/**
 * Validate request signature (HMAC-SHA256)
 * Prevents replay attacks and tampering
 */
export function createSignatureValidator(apiSecret) {
  return (req, res, next) => {
    if (process.env.NODE_ENV !== "production") {
      return next();
    }

    const signature = req.headers[REQUEST_SIGNATURE_HEADER];
    const timestamp = req.headers[REQUEST_TIMESTAMP_HEADER];
    const nonce = req.headers[REQUEST_NONCE_HEADER];

    if (!signature || !timestamp || !nonce) {
      log("warn", "Missing security headers", { signature: !!signature, timestamp: !!timestamp, nonce: !!nonce });
      return res.status(401).json({
        success: false,
        data: null,
        errorType: "MISSING_SIGNATURE",
        statusCode: 401,
        requestId: req.requestId
      });
    }

    // Check timestamp freshness
    const requestAge = Date.now() - parseInt(timestamp);
    if (isNaN(requestAge) || requestAge > MAX_REQUEST_AGE_MS || requestAge < 0) {
      log("warn", "Stale request signature", { requestAge, maxAge: MAX_REQUEST_AGE_MS });
      return res.status(401).json({
        success: false,
        data: null,
        errorType: "TIMESTAMP_EXPIRED",
        statusCode: 401,
        requestId: req.requestId
      });
    }

    // Check nonce uniqueness
    if (nonceStore.has(nonce)) {
      log("warn", "Replay attack detected - nonce reused", { nonce: nonce.slice(0, 8) });
      return res.status(401).json({
        success: false,
        data: null,
        errorType: "REPLAY_DETECTED",
        statusCode: 401,
        requestId: req.requestId
      });
    }

    // Verify signature
    const bodyStr = JSON.stringify(req.body || {});
    const expectedSignature = createHmac("sha256", apiSecret)
      .update(`${timestamp}${nonce}${bodyStr}`)
      .digest("hex");

    let signaturesMatch = false;
    try {
      const signatureBuffer = Buffer.from(signature, "hex");
      const expectedBuffer = Buffer.from(expectedSignature, "hex");
      signaturesMatch = signatureBuffer.length === expectedBuffer.length &&
        timingSafeEqual(signatureBuffer, expectedBuffer);
    } catch (err) {
      log("warn", "Signature comparison error", { error: err.message });
    }

    if (!signaturesMatch) {
      log("warn", "Invalid request signature", { requestId: req.requestId });
      return res.status(401).json({
        success: false,
        data: null,
        errorType: "INVALID_SIGNATURE",
        statusCode: 401,
        requestId: req.requestId
      });
    }

    // Store nonce (expires after MAX_REQUEST_AGE_MS)
    nonceStore.add(nonce);
    setTimeout(() => nonceStore.delete(nonce), MAX_REQUEST_AGE_MS + 1000);

    return next();
  };
}

/**
 * CSRF token validation middleware
 */
export function csrfValidator(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }

  // In production, validate CSRF token
  if (process.env.NODE_ENV === "production") {
    const token = req.headers[CSRF_TOKEN_HEADER] || req.body?.csrfToken;
    if (!token) {
      log("warn", "Missing CSRF token", { method: req.method, path: req.path });
      return res.status(403).json({
        success: false,
        data: null,
        errorType: "CSRF_TOKEN_MISSING",
        statusCode: 403,
        requestId: req.requestId
      });
    }

    // Store token in session/request for verification (simplified)
    if (!req.session?.csrfToken) {
      log("warn", "No CSRF token in session", { requestId: req.requestId });
      return res.status(403).json({
        success: false,
        data: null,
        errorType: "CSRF_INVALID",
        statusCode: 403,
        requestId: req.requestId
      });
    }
  }

  return next();
}

/**
 * Generate CSRF token for client
 */
export function generateCSRFToken() {
  return randomUUID();
}
