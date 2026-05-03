import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import session from "express-session";
import csrf from "csurf";
import ipRangeCheck from "ip-range-check";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";
import { createHash, randomUUID } from "crypto";
import { getFallbackResponse, FALLBACK_RESPONSES } from "./lib/fallbacks.js";
import { validatePrompt, validateContext, validateLanguage, validateMode } from "./lib/validation.js";
import { CONFIG } from "./config.js";
import { log } from "./lib/logger.js";
import { redis, redisIsMemory } from "./lib/redis.js";
import db from "./lib/db.js";
import { createTraceContext, startSpan, finishSpan } from "./lib/tracing.js";
import { generateAIResponse, generateAIStream } from "./lib/services/aiService.js";
import { CacheService } from "./lib/services/cacheService.js";
import { DBService } from "./lib/services/dbService.js";
import { sanitizeContext } from "./lib/services/validationService.js";
import { createAuthMiddleware } from "./lib/middleware/auth.js";
import { createRequestSigningMiddleware, signRequestPayload } from "./lib/middleware/security.js";
import { createRateLimitMiddleware } from "./lib/middleware/rateLimit.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const cacheService = new CacheService(redis, CONFIG, redisIsMemory);
const dbService = new DBService(db);
const auth = createAuthMiddleware(redis);
const enforceSecurity = process.env.NODE_ENV === "production" && process.env.VITEST !== "true";
const requestSigningMiddleware = createRequestSigningMiddleware(redis);

const TRUSTED_PROXY_RANGES = ["127.0.0.1/32", "::1/128"];
app.set("trust proxy", (ip) => TRUSTED_PROXY_RANGES.some((range) => ipRangeCheck(ip, range)));

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean);
if (!allowedOrigins || allowedOrigins.includes("*")) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Invalid CORS configuration");
  }
}

app.use(cors({
  origin: allowedOrigins || ["http://localhost:5173"],
  credentials: true
}));
app.use(compression({ threshold: 1024 }));
app.use(express.json({ limit: "1mb" }));
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

app.use(session({
  secret: process.env.SESSION_SECRET || "vote-path-session-secret",
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  }
}));

const csrfProtection = csrf({ cookie: false });
if (enforceSecurity) {
  app.use(csrfProtection);
}

app.use(express.static(path.join(__dirname, "dist")));

const apiKey = process.env.GEMINI_API_KEY;
let activeRequests = 0;
let server;

function sendEnvelope(res, statusCode, data = null, errorType = null, requestId = null) {
  return res.status(statusCode).json({
    success: statusCode < 400,
    data,
    errorType,
    statusCode,
    requestId
  });
}

function buildCacheKey({ prompt, context, language, mode }) {
  return createHash("sha256")
    .update(`${String(prompt)}::${String(context)}::${String(language)}::${String(mode)}`)
    .digest("hex");
}

function authRequestMiddleware(req, res, next) {
  return auth.authAPI(req, res, next);
}

function metricsRequestMiddleware(req, res, next) {
  return auth.authMetrics(req, res, next);
}

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
      dbService.logRequest(requestId, promptHash, res.statusCode);
    } catch (error) {
      log("warn", "DB log write failed", { requestId, message: error.message });
    }
  });

  next();
});

app.get("/security/bootstrap", (req, res) => {
  return sendEnvelope(res, 200, {
    csrfToken: process.env.NODE_ENV === "production" && typeof req.csrfToken === "function" ? req.csrfToken() : null,
    securityMode: process.env.SECURITY_MODE || (process.env.NODE_ENV === "production" ? "strict" : "test")
  }, null, req.requestId);
});

app.post("/security/sign", (req, res) => {
  if (!process.env.SIGNING_SECRET) {
    return sendEnvelope(res, 500, null, "SIGNING_SECRET_MISSING", req.requestId);
  }

  const { method, path: requestPath, body, timestamp, nonce } = req.body || {};
  const normalizedMethod = String(method || "").toUpperCase();
  const normalizedPath = String(requestPath || "");
  const normalizedTimestamp = String(timestamp || "");
  const normalizedNonce = String(nonce || "");

  if (!normalizedMethod || !normalizedPath || !normalizedTimestamp || !normalizedNonce) {
    return sendEnvelope(res, 400, null, "INVALID_INPUT", req.requestId);
  }

  const signature = signRequestPayload({
    secret: process.env.SIGNING_SECRET,
    method: normalizedMethod,
    path: normalizedPath,
    body: typeof body === "string" ? body : JSON.stringify(body || ""),
    timestamp: normalizedTimestamp,
    nonce: normalizedNonce
  });

  return sendEnvelope(res, 200, {
    signature,
    timestamp: normalizedTimestamp,
    nonce: normalizedNonce
  }, null, req.requestId);
});

app.use("/api", authRequestMiddleware);
app.use("/metrics", metricsRequestMiddleware);
app.use(requestSigningMiddleware);
app.use((req, res, next) => {
  if (req.method !== "POST" || req.path !== "/api/ask") {
    return next();
  }
  return createRateLimitMiddleware(redis)(req, res, next);
});

function writeSseEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

app.post("/api/ask", async (req, res) => {
  const requestId = req.requestId || randomUUID();
  const requestSpan = startSpan("api.ask", req.traceContext || { traceId: requestId });
  const now = Date.now();

  try {
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
      return sendEnvelope(res, 200, responseData, null, requestId);
    }

    const { prompt, mode, language = "English", context = null } = req.body || {};
    const finalMode = validateMode(mode);

    const promptValidation = validatePrompt(prompt);
    if (!promptValidation.valid) {
      const errorData = getFallbackResponse("INVALID_INPUT", requestId);
      finishSpan(requestSpan, log, { status: "invalid_input" });
      return sendEnvelope(res, 400, errorData, "INVALID_INPUT", requestId);
    }

    const contextValidation = validateContext(context);
    if (!contextValidation.valid) {
      const errorData = getFallbackResponse("INVALID_INPUT", requestId);
      finishSpan(requestSpan, log, { status: "invalid_context" });
      return sendEnvelope(res, 400, errorData, "INVALID_INPUT", requestId);
    }

    const finalContext = sanitizeContext(contextValidation.value || "");
    const finalLanguage = validateLanguage(language).value;
    const cacheKey = `cache:${buildCacheKey({ prompt, context: finalContext, language: finalLanguage, mode: finalMode })}`;

    const cachedResponse = await cacheService.getCache(cacheKey);
    if (cachedResponse) {
      cachedResponse.requestId = requestId;
      if (cachedResponse._meta) {
        cachedResponse._meta.cached = true;
      }

      res.setHeader("X-Response-Time", String(Date.now() - now));
      res.setHeader("X-Cache", "hit");
      res.setHeader("Cache-Control", "private, max-age=60");
      finishSpan(requestSpan, log, { status: "cache_hit" });
      return sendEnvelope(res, 200, cachedResponse, null, requestId);
    }

    const lockAcquired = await cacheService.acquireLock(cacheKey, requestId);
    if (!lockAcquired) {
      await cacheService.waitForRelease(cacheKey, 10000);
      const pendingResponse = await cacheService.getCache(cacheKey);
      if (pendingResponse) {
        pendingResponse.requestId = requestId;
        if (pendingResponse._meta) {
          pendingResponse._meta.cached = true;
        }

        res.setHeader("X-Response-Time", String(Date.now() - now));
        res.setHeader("X-Cache", "deduped");
        finishSpan(requestSpan, log, { status: "deduped" });
        return sendEnvelope(res, 200, pendingResponse, null, requestId);
      }
    }

    try {
      const aiResult = await generateAIResponse({
        prompt,
        context: finalContext,
        language: finalLanguage,
        mode: finalMode,
        stream: false
      });

      let parsed = aiResult.success && aiResult.data ? aiResult.data : FALLBACK_RESPONSES.DEFAULT;
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

      await cacheService.setCache(cacheKey, responseData, Math.max(1, Math.floor(CONFIG.CACHE_TTL / 1000)));
      res.setHeader("X-Response-Time", String(Date.now() - now));
      res.setHeader("X-Cache", "miss");
      res.setHeader("Cache-Control", "private, max-age=60");
      finishSpan(requestSpan, log, { status: "miss", responseTitle: responseData?.title });
      return sendEnvelope(res, 200, responseData, null, requestId);
    } finally {
      await cacheService.releaseLock(cacheKey);
    }
  } catch (error) {
    log("error", "AI Error", { message: error.message, requestId });
    finishSpan(requestSpan, log, { status: "error", message: error.message });
    const errorData = getFallbackResponse("AI_ERROR", requestId);
    return sendEnvelope(res, 500, errorData, "AI_ERROR", requestId);
  }
});

app.post("/api/ask/stream", async (req, res) => {
  const requestId = req.requestId || randomUUID();
  const requestSpan = startSpan("api.ask.stream", req.traceContext || { traceId: requestId });
  const now = Date.now();
  const streamController = new AbortController();

  req.on("close", () => {
    streamController.abort();
  });

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    if (!apiKey) {
      const responseData = {
        ...FALLBACK_RESPONSES.DEFAULT,
        lastUpdated: new Date().toISOString(),
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

      writeSseEvent(res, "message", { partial: responseData.simple || responseData.title || "" });
      writeSseEvent(res, "end", { success: true, response: responseData, requestId });
      finishSpan(requestSpan, log, { status: "fallback_no_api_key" });
      return res.end();
    }

    const { prompt, mode, language = "English", context = null } = req.body || {};
    const finalMode = validateMode(mode);

    const promptValidation = validatePrompt(prompt);
    if (!promptValidation.valid) {
      const errorData = getFallbackResponse("INVALID_INPUT", requestId);
      finishSpan(requestSpan, log, { status: "invalid_input" });
      writeSseEvent(res, "end", { success: false, errorType: "INVALID_INPUT", response: errorData, requestId });
      return res.end();
    }

    const contextValidation = validateContext(context);
    if (!contextValidation.valid) {
      const errorData = getFallbackResponse("INVALID_INPUT", requestId);
      finishSpan(requestSpan, log, { status: "invalid_context" });
      writeSseEvent(res, "end", { success: false, errorType: "INVALID_INPUT", response: errorData, requestId });
      return res.end();
    }

    const finalContext = sanitizeContext(contextValidation.value || "");
    const finalLanguage = validateLanguage(language).value;
    const cacheKey = `cache:${buildCacheKey({ prompt, context: finalContext, language: finalLanguage, mode: finalMode })}`;

    const cachedResponse = await cacheService.getCache(cacheKey);
    if (cachedResponse) {
      cachedResponse.requestId = requestId;
      if (cachedResponse._meta) {
        cachedResponse._meta.cached = true;
      }

      writeSseEvent(res, "message", { partial: cachedResponse.simple || cachedResponse.title || "" });
      writeSseEvent(res, "end", { success: true, response: cachedResponse, requestId });
      finishSpan(requestSpan, log, { status: "cache_hit" });
      return res.end();
    }

    const lockAcquired = await cacheService.acquireLock(cacheKey, requestId);
    if (!lockAcquired) {
      await cacheService.waitForRelease(cacheKey, 10000);
      const pendingResponse = await cacheService.getCache(cacheKey);
      if (pendingResponse) {
        pendingResponse.requestId = requestId;
        if (pendingResponse._meta) {
          pendingResponse._meta.cached = true;
        }

        writeSseEvent(res, "message", { partial: pendingResponse.simple || pendingResponse.title || "" });
        writeSseEvent(res, "end", { success: true, response: pendingResponse, requestId });
        finishSpan(requestSpan, log, { status: "deduped" });
        return res.end();
      }
    }

    try {
      let accumulated = "";
      for await (const event of generateAIStream({
        prompt,
        context: finalContext,
        language: finalLanguage,
        mode: finalMode,
        signal: streamController.signal
      })) {
        if (event.type === "chunk") {
          accumulated += event.text || "";
          writeSseEvent(res, "message", { partial: event.text || "", accumulated });
        } else if (event.type === "end") {
          const responseData = {
            ...(event.response || FALLBACK_RESPONSES.DEFAULT),
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

          await cacheService.setCache(cacheKey, responseData, Math.max(1, Math.floor(CONFIG.CACHE_TTL / 1000)));
          writeSseEvent(res, "end", { success: true, response: responseData, requestId });
          finishSpan(requestSpan, log, { status: "stream_complete", responseTitle: responseData?.title });
          return res.end();
        } else if (event.type === "error") {
          const errorData = getFallbackResponse(event.errorType || "AI_ERROR", requestId);
          writeSseEvent(res, "end", { success: false, errorType: event.errorType || "AI_ERROR", response: errorData, requestId });
          finishSpan(requestSpan, log, { status: "stream_error", errorType: event.errorType || "AI_ERROR" });
          return res.end();
        }
      }
    } finally {
      await cacheService.releaseLock(cacheKey);
    }
  } catch (error) {
    log("error", "AI Stream Error", { message: error.message, requestId });
    finishSpan(requestSpan, log, { status: "error", message: error.message });
    writeSseEvent(res, "end", { success: false, errorType: "AI_ERROR", requestId });
    return res.end();
  }
});

app.get("/health", (req, res) => {
  return sendEnvelope(res, 200, {
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }, null, req.requestId);
});

app.get("/ready", (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return sendEnvelope(res, 500, { ready: false }, "CONFIG_ERROR", req.requestId);
  }

  return sendEnvelope(res, 200, { ready: true }, null, req.requestId);
});

app.get("/metrics", async (req, res) => {
  try {
    const cacheKeys = await redis.keys("cache:*");
    const logStats = dbService.getLogStats();
    return sendEnvelope(res, 200, {
      uptime: process.uptime(),
      requests: logStats.count,
      cacheSize: Array.isArray(cacheKeys) ? cacheKeys.length : 0
    }, null, req.requestId);
  } catch (error) {
    return sendEnvelope(res, 500, null, "METRICS_UNAVAILABLE", req.requestId);
  }
});

app.use((err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    return sendEnvelope(res, 403, null, "CSRF_INVALID", req.requestId);
  }
  return next(err);
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

export { app };

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
  } catch {
    // ignore
  }
}

setTimeout(async () => {
  await cacheService.warmCommonPrompts([
    { key: `cache:${buildCacheKey({ prompt: "What documents do I need to vote?", context: null, language: "English", mode: "normal" })}`, value: { ...FALLBACK_RESPONSES.DEFAULT, title: "Voting Basics", simple: "Start with voter registration and your polling booth.", source: "Election Commission of India" } },
    { key: `cache:${buildCacheKey({ prompt: "Generate my voting checklist", context: null, language: "English", mode: "normal" })}`, value: { ...FALLBACK_RESPONSES.DEFAULT, title: "Voting Checklist", simple: "Carry your ID, verify your roll, and reach the booth on time.", source: "Election Commission of India" } }
  ]);
}, 1500);

if (process.env.NODE_ENV !== "test") {
  const PORT = process.env.PORT || 3000;
  server = app.listen(PORT, () => log("info", `Server running on port ${PORT}`, { port: PORT }));

  process.on("SIGTERM", () => {
    log("info", "SIGTERM received, shutting down gracefully...");
    const shutdown = async () => {
      while (activeRequests > 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      server.close(() => process.exit(0));
    };
    shutdown();
  });
}
