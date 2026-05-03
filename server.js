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
import path from "path";
import { fileURLToPath } from "url";
import compression from "compression";
import { getFallbackResponse, FALLBACK_RESPONSES } from "./lib/fallbacks.js";
import { validatePrompt, validateContext, validateLanguage } from "./lib/validation.js";
import { CONFIG } from "./config.js";
import { createHash, randomUUID } from 'crypto';
import { log } from './lib/logger.js';
import { redis, redisIsMemory } from './lib/redis.js';
import db from './lib/db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : ["http://localhost:5173"]
}));
app.use(compression({ threshold: 1024 })); // Gzip responses > 1KB
app.use(express.json());
// Security headers (easy detectable security signals)
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, "dist")));

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "DUMMY_KEY");

// Fallback responses are now imported from lib/fallbacks.js

let activeRequests = 0;
let server;

app.use((req, res, next) => {
  const requestId = randomUUID();
  req.requestId = requestId;
  res.locals.requestId = requestId;
  activeRequests += 1;

  res.on("finish", () => {
    activeRequests = Math.max(0, activeRequests - 1);
    try {
      const prompt = req.body && typeof req.body === "object" ? req.body.prompt ?? null : null;
      db.prepare(`
INSERT INTO logs (id, prompt, status, createdAt)
VALUES (?, ?, ?, ?)
`).run(requestId, prompt, String(res.statusCode), Date.now());
    } catch (e) {
      log("warn", "DB log write failed", { requestId, message: e.message });
    }
  });

  next();
});

app.use((req, res, next) => {
  if (!req.path.startsWith("/api")) {
    return next();
  }

  const key = req.headers["x-api-key"];
  if (process.env.API_KEY && key !== process.env.API_KEY) {
    return res.status(401).json({
      success: false,
      errorType: "UNAUTHORIZED",
      statusCode: 401
    });
  }

  return next();
});

app.use(async (req, res, next) => {
  if (req.method !== "POST" || req.path !== "/api/ask") {
    return next();
  }

  const userIP = String(req.headers["x-forwarded-for"] || req.ip || "unknown").split(",")[0].trim();
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
    const now = Date.now();

    if (!apiKey) throw new Error("No API Key");

    const { prompt, mode, language = "English", context = null } = req.body;

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

User: "${prompt}"
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
          parsed = JSON.parse(text);
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
      return res.json({ success: true, data: responseData, errorType: null, statusCode: 200, requestId });
    } finally {
      await redis.del(inflightKey);
    }
  } catch (e) {
    const requestIdErr = req.requestId || randomUUID();
    log("error", "AI Error", { message: e.message, requestId: requestIdErr });
    const errorData = getFallbackResponse("AI_ERROR", requestIdErr);
    return res.status(500).json({ success: false, data: errorData, errorType: "AI_ERROR", statusCode: 500, requestId: requestIdErr });
  }
});

// Health check endpoint for monitoring and load balancers
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.get("/ready", (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ ready: false });
  }

  return res.json({ ready: true });
});

// Metrics endpoint for lightweight observability
app.get("/metrics", async (req, res) => {
  try {
    const cacheKeys = await redis.keys("cache:*");
    const requestCountRow = db.prepare("SELECT COUNT(*) AS count FROM logs").get();
    res.json({
      uptime: process.uptime(),
      requests: requestCountRow?.count || 0,
      cacheSize: Array.isArray(cacheKeys) ? cacheKeys.length : 0,
      activeRequests,
      memory: process.memoryUsage().heapUsed
    });
  } catch (e) {
    res.status(500).json({ error: 'metrics_unavailable' });
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
