/**
 * Authentication Middleware
 * Validates API keys with timing-safe comparison
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

export async function createAuthMiddleware(redis) {
  return {
    async authAPI(req, res, next) {
      if (process.env.NODE_ENV !== "production") {
        return next();
      }

      if (!process.env.API_KEY_MAIN) {
        await incrementAuthFailure(redis, "api", req.ip);
        return res.status(500).json({
          success: false,
          data: null,
          errorType: "CONFIG_ERROR",
          statusCode: 500,
          requestId: req.requestId
        });
      }

      const key = req.headers["x-api-key"];
      if (!constantTimeMatches(key, process.env.API_KEY_MAIN)) {
        const failures = await incrementAuthFailure(redis, "api", req.ip);
        if (failures >= 3) {
          log("warn", "Auth failed threshold exceeded", { route: "api", ip: req.ip, failures });
          return res.status(429).json({
            success: false,
            data: null,
            errorType: "RATE_LIMITED",
            statusCode: 429,
            requestId: req.requestId
          });
        }
        return res.status(401).json({
          success: false,
          data: null,
          errorType: "UNAUTHORIZED",
          statusCode: 401,
          requestId: req.requestId
        });
      }

      return next();
    },

    async authMetrics(req, res, next) {
      if (process.env.NODE_ENV !== "production") {
        return next();
      }

      if (!process.env.API_KEY_METRICS) {
        await incrementAuthFailure(redis, "metrics", req.ip);
        return res.status(500).json({
          success: false,
          data: null,
          errorType: "CONFIG_ERROR",
          statusCode: 500,
          requestId: req.requestId
        });
      }

      const key = req.headers["x-api-key"];
      if (!constantTimeMatches(key, process.env.API_KEY_METRICS)) {
        const failures = await incrementAuthFailure(redis, "metrics", req.ip);
        if (failures >= 3) {
          log("warn", "Auth failed threshold exceeded", { route: "metrics", ip: req.ip, failures });
          return res.status(429).json({
            success: false,
            data: null,
            errorType: "RATE_LIMITED",
            statusCode: 429,
            requestId: req.requestId
          });
        }
        return res.status(401).json({
          success: false,
          data: null,
          errorType: "UNAUTHORIZED",
          statusCode: 401,
          requestId: req.requestId
        });
      }

      return next();
    }
  };
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

export { constantTimeMatches };
