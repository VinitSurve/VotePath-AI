/**
 * Authentication Middleware
 * Split API and metrics keys with expiry validation.
 */

import { createHash, timingSafeEqual } from "crypto";
import { log } from "../logger.js";

function constantTimeMatches(candidate, expected) {
  const candidateHash = createHash("sha256").update(String(candidate || "")).digest();
  const expectedHash = createHash("sha256").update(String(expected || "")).digest();
  return candidateHash.length === expectedHash.length && timingSafeEqual(candidateHash, expectedHash);
}

function authFailedKey(route, ip) {
  return `auth_fail:${route}:${ip}`;
}

function isExpired(expiryEnvKey) {
  const expiry = process.env[expiryEnvKey];
  if (!expiry) return false;
  const expiryTime = Number(expiry);
  return Number.isFinite(expiryTime) && Date.now() > expiryTime;
}

async function incrementAuthFailure(redis, route, ip) {
  const key = authFailedKey(route, ip);
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pexpire(key, 60000);
    }
    return count;
  } catch (err) {
    log("warn", "Auth failure increment error", { key, error: err.message });
    return 1;
  }
}

function unauthorizedResponse(res, requestId, statusCode, errorType) {
  return res.status(statusCode).json({
    success: false,
    data: null,
    errorType,
    statusCode,
    requestId
  });
}

export function createAuthMiddleware(redis) {
  return {
    async authAPI(req, res, next) {
      if (process.env.NODE_ENV !== "production") return next();

      if (!process.env.API_KEY_MAIN || isExpired("API_KEY_MAIN_EXPIRES_AT")) {
        await incrementAuthFailure(redis, "api", req.ip || "unknown");
        return unauthorizedResponse(res, req.requestId, 500, "CONFIG_ERROR");
      }

      const key = req.headers["x-api-key"];
      if (!constantTimeMatches(key, process.env.API_KEY_MAIN)) {
        const failures = await incrementAuthFailure(redis, "api", req.ip || "unknown");
        return unauthorizedResponse(res, req.requestId, failures >= 3 ? 429 : 401, failures >= 3 ? "RATE_LIMITED" : "UNAUTHORIZED");
      }

      return next();
    },

    async authMetrics(req, res, next) {
      if (process.env.NODE_ENV !== "production") return next();

      if (!process.env.API_KEY_METRICS || isExpired("API_KEY_METRICS_EXPIRES_AT")) {
        await incrementAuthFailure(redis, "metrics", req.ip || "unknown");
        return unauthorizedResponse(res, req.requestId, 500, "CONFIG_ERROR");
      }

      const key = req.headers["x-api-key"];
      if (!constantTimeMatches(key, process.env.API_KEY_METRICS)) {
        const failures = await incrementAuthFailure(redis, "metrics", req.ip || "unknown");
        return unauthorizedResponse(res, req.requestId, failures >= 3 ? 429 : 401, failures >= 3 ? "RATE_LIMITED" : "UNAUTHORIZED");
      }

      return next();
    }
  };
}

export { constantTimeMatches };