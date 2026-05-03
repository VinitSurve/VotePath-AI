/*
 * VotePath-AI Backend Architecture
 * ================================
 * server.js:    Express app, request orchestration, routing
 * lib/cache.js: In-memory caching with TTL and LRU eviction
 * lib/validation.js: Input validation with configurable limits
 * lib/fallbacks.js: Error handling and fallback response factory
 * config.js:    Centralized configuration constants
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import helmet from "helmet";
import { z } from "zod";
import path from "path";
import { fileURLToPath } from "url";
import compression from "compression";
import { getFallbackResponse, FALLBACK_RESPONSES } from "./lib/fallbacks.js";
import { validatePrompt, validateContext, validateLanguage } from "./lib/validation.js";
import { CONFIG } from "./config.js";
import { createHash, randomUUID, timingSafeEqual } from "crypto";
import { log } from "./lib/logger.js";
import { redis, redisIsMemory } from "./lib/redis.js";
import db, { pruneLogs } from "./lib/db.js";
import { createTraceContext, startSpan, finishSpan } from "./lib/tracing.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const TRUSTED_PROXIES = ["127.0.0.1", "::1"];
app.set("trust proxy", function (ip) {
  return TRUSTED_PROXIES.includes(ip);
});
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean);
if (!allowedOrigins || allowedOrigins.includes("*")) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Invalid CORS configuration");
  }
}
app.use(cors({
  origin: allowedOrigins || ["http://localhost:5173"],
  credentials: false
}));
app.use(compression({ threshold: 1024 })); // Gzip responses > 1KB
app.use(express.json());
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "base-uri": ["'self'"],
      "object-src": ["'none'"],
      "frame-ancestors": ["'none'"],
      "img-src": ["'self'", "data:"],
      "script-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "connect-src": ["'self'"],
      "font-src": ["'self'", "data:"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Serve static files from the React app
app.use(express.static(path.join(__dirname, "dist")));

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "DUMMY_KEY");
const ResponseSchema = z.object({
  title: z.string(),
  steps: z.array(z.object({
    title: z.string(),
    desc: z.string()
  })),
  simple: z.string(),
  tips: z.array(z.string()),
  source: z.string()
});

function sanitize(input) {
  return String(input ?? "").replace(/[{}[\]<>]/g, "");
}

function sendEnvelope(res, statusCode, data = null, errorType = null, requestId = null) {
  return res.status(statusCode).json({
    success: statusCode < 400,
    data,
    errorType,
    statusCode,
    requestId
  });
}

function authFailedKey(route, ip) {
  return `auth_fail:${route}:${ip}`;
}

async function incrementAuthFailure(route, ip) {
  const key = authFailedKey(route, ip);
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pexpire(key, 60000);
    }
    return count;
  } catch {
    return 1;
  }
}

function constantTimeMatches(candidate, expected) {
  const candidateHash = createHash("sha256").update(String(candidate || "")).digest();
  const expectedHash = createHash("sha256").update(String(expected || "")).digest();
  return candidateHash.length === expectedHash.length && timingSafeEqual(candidateHash, expectedHash);
}

let activeRequests = 0;
let server;

app.use((req, res, next) => {
  const requestId = randomUUID();
  req.requestId = requestId;
  req.traceContext = createTraceContext(requestId, null);
  res.locals.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  res.setHeader("x-trace-id", requestId);
  activeRequests += 1;

  res.on("finish", () => {
    activeRequests = Math.max(0, activeRequests - 1);
    try {
      const rawPrompt = req.body && typeof req.body === "object" ? req.body.prompt : null;
      const promptHash = rawPrompt ? createHash("sha256").update(String(rawPrompt)).digest("hex") : null;
      db.prepare(`
INSERT INTO logs (id, prompt, status, createdAt)
VALUES (?, ?, ?, ?)
`).run(requestId, promptHash, String(res.statusCode), Date.now());
      pruneLogs();
    } catch (e) {
      log("warn", "DB log write failed", { requestId, message: e.message });
    }
  });

  next();
});

app.use("/api", async (req, res, next) => {
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  if (!process.env.API_KEY_MAIN) {
    incrementAuthFailure("api", req.ip || "unknown");
    return sendEnvelope(res, 500, null, "CONFIG_ERROR", req.requestId);
  }

  const key = req.headers["x-api-key"];
  if (!constantTimeMatches(key, process.env.API_KEY_MAIN)) {
    const failures = await incrementAuthFailure("api", req.ip || "unknown");
    if (failures >= 3) {
      return sendEnvelope(res, 429, null, "RATE_LIMITED", req.requestId);
    }
    return sendEnvelope(res, 401, null, "UNAUTHORIZED", req.requestId);
  }

  return next();
});

app.use("/metrics", async (req, res, next) => {
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  if (!process.env.API_KEY_METRICS) {
    incrementAuthFailure("metrics", req.ip || "unknown");
    return sendEnvelope(res, 500, null, "CONFIG_ERROR", req.requestId);
  }

  const key = req.headers["x-api-key"];
  if (!constantTimeMatches(key, process.env.API_KEY_METRICS)) {
    const failures = await incrementAuthFailure("metrics", req.ip || "unknown");
    if (failures >= 3) {
      return sendEnvelope(res, 429, null, "RATE_LIMITED", req.requestId);
    }
    return sendEnvelope(res, 401, null, "UNAUTHORIZED", req.requestId);
  }

  return next();
});

app.use(async (req, res, next) => {
  if (req.method !== "POST" || req.path !== "/api/ask") {
    return next();
  }

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
    if (count > 1) {
      const requestId = req.requestId || randomUUID();
      res.setHeader("Retry-After", "2");
      res.setHeader("X-RateLimit-Limit", "1");
      res.setHeader("X-RateLimit-Remaining", "0");
      const errorData = getFallbackResponse("RATE_LIMIT", requestId);
      log("warn", "Rate limit hit", { requestId, userIP });
      return res.status(429).json({ success: false, data: errorData, errorType: "RATE_LIMIT", statusCode: 429, requestId });
    }
    return next();
  } catch (e) {
    return next();
  }
});

app.post("/api/ask", async (req, res) => {
  try {
    const requestId = req.requestId || randomUUID();
    const requestSpan = startSpan("api.ask", req.traceContext || { traceId: requestId });
    const now = Date.now();

    if (!apiKey) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("No API Key");
      }
      const fallbackResponse = {
        ...FALLBACK_RESPONSES.DEFAULT,
        lastUpdated: new Date().toISOString(),
        requestId
      };
      const responseData = {
        ...fallbackResponse,
        requestId,
        _meta: {
          temperature: 0.3,
          topP: 0.8,
          responseTime: Date.now() - now,
          cached: false,
          timeout: 8000,
          retryable: false
        }
      };

      res.setHeader("X-Response-Time", String(Date.now() - now));
      res.setHeader("X-Cache", "miss");
      res.setHeader("Cache-Control", "private, max-age=60");
      finishSpan(requestSpan, log, { status: "fallback_no_api_key" });
      return res.json({ success: true, data: responseData, errorType: null, statusCode: 200, requestId });
    }

    const { prompt, mode, language = "English", context = null } = req.body;

    const safePrompt = sanitize(prompt);

    const promptValidation = validatePrompt(prompt);
    if (!promptValidation.valid) {
      log("warn", "Invalid input", { requestId, reason: promptValidation.reason });
      const errorData = getFallbackResponse("INVALID_INPUT", requestId);
      return res.status(400).json({ success: false, data: errorData, errorType: "INVALID_INPUT", statusCode: 400, requestId });
    }

    const contextValidation = validateContext(context);
    if (!contextValidation.valid) {
      log("warn", "Invalid context", { requestId });
      const errorData = getFallbackResponse("INVALID_INPUT", requestId);
      return res.status(400).json({ success: false, data: errorData, errorType: "INVALID_INPUT", statusCode: 400, requestId });
    }

    if (contextValidation.trimmed) {
      log("warn", "Context trimmed", { requestId, originalLength: contextValidation.originalLength, trimmedLength: contextValidation.value.length });
    }

    const finalContext = contextValidation.value;
    const languageValidation = validateLanguage(language);
    const finalLanguage = languageValidation.value;

    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite-preview",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
        topP: 0.8,
        maxOutputTokens: 512,
      }
    });

    const promptText = `
You are VotePath AI, assistant for Indian elections.${mode === "elis" ? " Explain simply." : ""}

Instructions:
- IMPORTANT: Return ONLY a single valid JSON object with the exact schema described below. Do NOT include any surrounding explanation, markdown, or extra text.
- If you cannot produce valid JSON, return this exact fallback JSON object: {"title":"I can't answer that right now","steps":[],"simple":"","tips":[],"source":""}
- Respond ONLY in ${finalLanguage}.
- Return JSON: {title, steps[], simple, tips[], source}
- Off-topic → title="Off-topic Question", simple="I answer Indian election questions only."
- Elections → steps=[{title, desc}], source="Election Commission of India"
- Translate values to ${finalLanguage}, keys stay English
- Max 120 words${finalContext ? `\nContext: ${finalContext}` : ""}

User Input:
"""${safePrompt}"""
`;

    const requestHash = createHash("sha256")
      .update(`${String(prompt)}::${String(finalContext)}::${finalLanguage}::${String(mode || "")}`)
      .digest("hex");
    const cacheKey = `cache:${requestHash}`;
    const inflightKey = `inflight:${requestHash}`;

    const cachedRaw = await redis.get(cacheKey);
    if (cachedRaw) {
      const cachedResponse = JSON.parse(cachedRaw);
      cachedResponse.requestId = requestId;
      if (cachedResponse._meta) {
        cachedResponse._meta.cached = true;
      }
      log("info", "Cache hit", { requestId, cacheKey });
      finishSpan(requestSpan, log, { status: "cache_hit" });
      res.setHeader("X-Response-Time", String(Date.now() - now));
      res.setHeader("X-Cache", "hit");
      res.setHeader("Cache-Control", "private, max-age=60");
      return res.json({ success: true, data: cachedResponse, errorType: null, statusCode: 200, requestId });
    }

    const lockAcquired = await redis.set(inflightKey, requestId, "NX", "PX", 10000);
    if (!lockAcquired) {
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        const pendingRaw = await redis.get(cacheKey);
        if (pendingRaw) {
          const pendingResponse = JSON.parse(pendingRaw);
          pendingResponse.requestId = requestId;
          if (pendingResponse._meta) {
            pendingResponse._meta.cached = true;
          }
          log("info", "Request deduplication: cache materialized", { requestId, cacheKey });
          finishSpan(requestSpan, log, { status: "deduped" });
          res.setHeader("X-Response-Time", String(Date.now() - now));
          res.setHeader("X-Cache", "deduped");
          return res.json({ success: true, data: pendingResponse, errorType: null, statusCode: 200, requestId });
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    let parsed;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      try {
        const result = await model.generateContent(promptText, { signal: controller.signal });
        const text = result.response.text();
        try {
          parsed = ResponseSchema.parse(JSON.parse(text));
          if (parsed.title === "Off-topic Question") {
            log("info", "Off-topic detected", { requestId });
          }
          const englishWords = parsed.simple?.match(/\b(the|is|are|and)\b/gi)?.length || 0;
          if (language !== "English" && englishWords > 5) {
            log("warn", "Language mismatch", { requestId, language });
          }
        } catch (parseErr) {
          log("error", "JSON parse error", { requestId, text: text.slice(0, 100) });
          parsed = FALLBACK_RESPONSES.DEFAULT;
        }
      } catch (genErr) {
        let errorType = "GENERATION_ERROR";
        if (genErr.name === "AbortError") errorType = "TIMEOUT";
        if (genErr.message?.includes("429")) errorType = "RATE_LIMIT";
        if (genErr.message?.toLowerCase().includes("safety")) errorType = "SAFETY_FILTER";
        log("error", "Model error", { requestId, errorType, message: genErr.message });
        parsed = FALLBACK_RESPONSES.DEFAULT;
      } finally {
        clearTimeout(timeout);
      }

      parsed = parsed || FALLBACK_RESPONSES.DEFAULT;
      parsed.title = parsed.title || FALLBACK_RESPONSES.DEFAULT.title;
      parsed.steps = parsed.steps || FALLBACK_RESPONSES.DEFAULT.steps;
      parsed.simple = parsed.simple || FALLBACK_RESPONSES.DEFAULT.simple;
      parsed.tips = parsed.tips || FALLBACK_RESPONSES.DEFAULT.tips;
      parsed.source = parsed.source || FALLBACK_RESPONSES.DEFAULT.source;
      parsed.lastUpdated = new Date().toISOString();
      parsed.requestId = requestId;

      const responseData = {
        ...parsed,
        requestId,
        _meta: {
          temperature: 0.3,
          topP: 0.8,
          responseTime: Date.now() - now,
          cached: false,
          timeout: 8000,
          retryable: false
        }
      };

      await redis.set(cacheKey, JSON.stringify(responseData), "EX", Math.max(1, Math.floor(CONFIG.CACHE_TTL / 1000)));

      res.setHeader("X-Response-Time", String(Date.now() - now));
      res.setHeader("X-Cache", "miss");
      res.setHeader("Cache-Control", "private, max-age=60");
      log("info", "AI response", { requestId, time: Date.now() - now, title: responseData?.title });
      finishSpan(requestSpan, log, { status: "miss", responseTitle: responseData?.title });
      return res.json({ success: true, data: responseData, errorType: null, statusCode: 200, requestId });
    } finally {
      await redis.del(inflightKey);
    }
  } catch (e) {
    const requestIdErr = req.requestId || randomUUID();
    const errorSpan = startSpan("api.ask.error", req.traceContext || { traceId: requestIdErr });
    log("error", "AI Error", { message: e.message, requestId: requestIdErr });
    const errorData = getFallbackResponse("AI_ERROR", requestIdErr);
    finishSpan(errorSpan, log, { status: "error", message: e.message });
    return res.status(500).json({ success: false, data: errorData, errorType: "AI_ERROR", statusCode: 500, requestId: requestIdErr });
  }
});

// Health check endpoint for monitoring and load balancers
app.get("/health", (req, res) => {
  return sendEnvelope(res, 200, { status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() }, null, req.requestId);
});

app.get("/ready", (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return sendEnvelope(res, 500, { ready: false }, "CONFIG_ERROR", req.requestId);
  }

  return sendEnvelope(res, 200, { ready: true }, null, req.requestId);
});

// Metrics endpoint for lightweight observability
app.get("/metrics", async (req, res) => {
  try {
    const cacheKeys = await redis.keys("cache:*");
    const requestCountRow = db.prepare("SELECT COUNT(*) AS count FROM logs").get();
    return sendEnvelope(res, 200, {
      uptime: process.uptime(),
      requests: requestCountRow?.count || 0,
      cacheSize: Array.isArray(cacheKeys) ? cacheKeys.length : 0
    }, null, req.requestId);
  } catch (e) {
    return sendEnvelope(res, 500, null, "METRICS_UNAVAILABLE", req.requestId);
  }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Export app for tests
export { app };

// Test helper to clear in-memory request log between test cases
export function clearRequestLog() {
  try {
    if (redisIsMemory) {
      for (const key of redis.keys("rate_limit:*")) {
        redis.del(key);
      }
      for (const key of redis.keys("inflight:*")) {
        redis.del(key);
      }
      for (const key of redis.keys("auth_fail:*")) {
        redis.del(key);
      }
    }
  } catch (e) {
    // ignore
  }
}

if (process.env.NODE_ENV !== "test") {
  const PORT = process.env.PORT || 3000;
  server = app.listen(PORT, () => log('info', `Server running on port ${PORT}`, { port: PORT }));
  
  // Graceful shutdown handler for SIGTERM (docker stop, kubernetes termination, etc.)
  process.on("SIGTERM", () => {
    log('info', 'SIGTERM received, shutting down gracefully...');
    const shutdown = async () => {
      while (activeRequests > 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (server) {
        server.close(() => process.exit(0));
        return;
      }

      process.exit(0);
    };

    server?.close(() => process.exit(0));
    shutdown().catch(() => process.exit(0));
  });
}
