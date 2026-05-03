/**
 * Rate Limiting Middleware
 * Prevents abuse and DDoS attacks
 */

import { log } from "../logger.js";
import { CONFIG } from "../../config.js";
import { getFallbackResponse } from "../fallbacks.js";

/**
 * Create rate limit middleware
 */
export function createRateLimitMiddleware(redis) {
  return async (req, res, next) => {
    if (req.method !== "POST" || req.path !== "/api/ask") {
      return next();
    }

    // Allow bypass in test mode
    if (process.env.ENABLE_RATE_LIMIT_TEST === "false") {
      return next();
    }

    const userIP = req.ip || "unknown";
    const rateKey = `rate_limit:${userIP}`;

    try {
      const count = await redis.incr(rateKey);
      if (count === 1) {
        await redis.pexpire(rateKey, CONFIG.RATE_LIMIT_MS);
      }

      // Log rate limit events
      if (count > 1) {
        log("debug", "Rate limit hit", { ip: userIP, requestId: req.requestId, count });
      }

      if (count > 1) {
        res.setHeader("Retry-After", "2");
        res.setHeader("X-RateLimit-Limit", "1");
        res.setHeader("X-RateLimit-Remaining", "0");
        const errorData = getFallbackResponse("RATE_LIMIT", req.requestId);
        return res.status(429).json({
          success: false,
          data: errorData,
          errorType: "RATE_LIMIT",
          statusCode: 429,
          requestId: req.requestId
        });
      }

      return next();
    } catch (err) {
      log("warn", "Rate limit middleware error", { error: err.message });
      // On error, allow request to proceed (fail open)
      return next();
    }
  };
}

/**
 * Get rate limit status for a user
 */
export async function getRateLimitStatus(redis, userIP) {
  try {
    const rateKey = `rate_limit:${userIP}`;
    const count = await redis.get(rateKey);
    return {
      count: parseInt(count || 0),
      limited: parseInt(count || 0) > 0
    };
  } catch (err) {
    log("warn", "Get rate limit status error", { error: err.message });
    return { count: 0, limited: false };
  }
}

/**
 * Reset rate limit for a user
 */
export async function resetRateLimit(redis, userIP) {
  try {
    const rateKey = `rate_limit:${userIP}`;
    await redis.del(rateKey);
    return true;
  } catch (err) {
    log("warn", "Reset rate limit error", { error: err.message });
    return false;
  }
}
