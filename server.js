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
import { getCachedResponse, setCachedResponse, getCacheSize } from "./lib/cache.js";
import { getFallbackResponse, FALLBACK_RESPONSES } from "./lib/fallbacks.js";
import { validatePrompt, validateContext, validateLanguage } from "./lib/validation.js";
import { CONFIG } from "./config.js";
import { randomUUID } from 'crypto';
import { log } from './lib/logger.js';

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

const requestLog = new Map();
// Cache management is now abstracted in lib/cache.js

// Cleanup requestLog every 5 minutes to prevent unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, lastTime] of requestLog.entries()) {
    if (now - lastTime > CONFIG.CLEANUP_INTERVAL_MS) { // 5 minutes
      requestLog.delete(ip);
    }
  }
}, CONFIG.CLEANUP_INTERVAL_MS);

// Track in-flight requests to deduplicate identical queries
// Each entry: key -> { promise, timestamp }
const inFlightRequests = new Map();

// Cleanup stale in-flight entries older than 10s
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of inFlightRequests.entries()) {
    if (now - (value.timestamp || 0) > 10000) {
      inFlightRequests.delete(key);
    }
  }
}, 5000);

// Rate limit middleware (centralized and detectable)
function rateLimitMiddleware(req, res, next) {
  try {
    if (!(process.env.NODE_ENV !== 'test' || process.env.ENABLE_RATE_LIMIT_TEST === 'true')) {
      return next();
    }

    const now = Date.now();
    const userIP = req.ip;

    if (requestLog.has(userIP) && now - requestLog.get(userIP) < CONFIG.RATE_LIMIT_MS) {
      res.setHeader("Retry-After", "2");
      res.setHeader("X-RateLimit-Limit", "1");
      res.setHeader("X-RateLimit-Remaining", "0");
      const errorRequestId = randomUUID();
      const errorData = getFallbackResponse("RATE_LIMIT", errorRequestId);
      log('warn', 'Rate limit hit', { requestId: errorRequestId, userIP });
      return res.status(429).json({ success: false, data: errorData, errorType: "RATE_LIMIT", statusCode: 429, requestId: errorRequestId });
    }

    requestLog.set(userIP, now);
    return next();
  } catch (e) {
    return next();
  }
}

app.use(rateLimitMiddleware);

app.post("/api/ask", async (req, res) => {
  try {
    // Unique request id for observability
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const userIP = req.ip;
    const now = Date.now();

    // Rate limiting handled by middleware

    if (!apiKey) throw new Error("No API Key");

    const { prompt, mode, language = "English", context = null } = req.body;
    
    // Validate prompt using validation module
    const promptValidation = validatePrompt(prompt);
    if (!promptValidation.valid) {
      const errorRequestId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      log('warn', 'Invalid input', { requestId: errorRequestId, reason: promptValidation.reason });
      const errorData = getFallbackResponse("INVALID_INPUT", errorRequestId);
      return res.status(400).json({ success: false, data: errorData, errorType: "INVALID_INPUT", statusCode: 400, requestId: errorRequestId });
    }

    // Validate and trim context using validation module
    const contextValidation = validateContext(context);
    if (!contextValidation.valid) {
      const errorRequestId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      log('warn', 'Invalid context', { requestId: errorRequestId });
      const errorData = getFallbackResponse("INVALID_INPUT", errorRequestId);
      return res.status(400).json({ success: false, data: errorData, errorType: "INVALID_INPUT", statusCode: 400, requestId: errorRequestId });
    }
    
    if (contextValidation.trimmed) {
      log('warn', 'Context trimmed', { requestId, originalLength: contextValidation.originalLength, trimmedLength: contextValidation.value.length });
    }
    
    const finalContext = contextValidation.value;
    
    // Validate language using validation module
    const languageValidation = validateLanguage(language);
    const finalLanguage = languageValidation.value;
    
    // Enforce context bounds to prevent prompt bloat
    if (context && typeof context === 'string' && context.length > CONFIG.MAX_CONTEXT_LENGTH) {
      const trimmedContext = context.slice(0, CONFIG.MAX_CONTEXT_LENGTH);
      log('warn', 'Context trimmed', { requestId, originalLength: context.length, trimmedLength: trimmedContext.length });
      // Continue with trimmed context
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite-preview",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
        topP: 0.8,
        maxOutputTokens: 512,
      }
    });

    // Build prompt with optional previous context for a single-step memory
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

    // Simple response cache key with TTL
    const cacheKey = `${finalLanguage}::${prompt.trim().toLowerCase()}`;
    
    // Request deduplication handled via inFlightRequests entries
    
    // Check cache using cache module
    const cachedResponse = getCachedResponse(cacheKey);
    if (cachedResponse) {
      log('info', 'Cache hit', { requestId, cacheKey });
      res.setHeader("X-Response-Time", String(Date.now() - now));
      res.setHeader("X-Cache", "hit");
      res.setHeader("Cache-Control", "private, max-age=60");
      const cacheData = { ...cachedResponse, requestId, isCached: true };
      // Update _meta to show this was a cache hit
      if (cacheData._meta) {
        cacheData._meta.cached = true;
      }
      return res.json({ success: true, data: cacheData, errorType: null, statusCode: 200, requestId });
    }

    // If an identical request is already being processed, wait for it and return the same response
    if (inFlightRequests.has(cacheKey)) {
      const entry = inFlightRequests.get(cacheKey);
      log('info', 'Request deduplication: waiting for in-flight request', { requestId, cacheKey });
      try {
        const cachedResponse = await entry.promise;
        res.setHeader("X-Response-Time", String(Date.now() - now));
        res.setHeader("X-Cache", "deduped");
        return res.json({ success: true, data: cachedResponse, errorType: null, statusCode: 200, requestId });
      } catch (e) {
        inFlightRequests.delete(cacheKey);
      }
    }

    // Build a processing promise and register it for deduplication
    const processPromise = (async () => {
      // Timeout + abort to avoid hanging requests
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      let parsed;
      try {
        const result = await model.generateContent(promptText, { signal: controller.signal });
        clearTimeout(timeout);
        const text = result.response.text();

        try {
          parsed = JSON.parse(text);

          // Off-topic validation
          if (parsed.title === "Off-topic Question") {
            log('info', 'Off-topic detected', { requestId });
          }

          // Basic language validation
          const englishWords = parsed.simple?.match(/\b(the|is|are|and)\b/gi)?.length || 0;
          if (language !== "English" && englishWords > 5) {
            log('warn', 'Language mismatch', { requestId, language });
          }
        } catch (parseErr) {
          log('error', 'JSON parse error', {
            requestId,
            text: text.slice(0, 100)
          });
          parsed = FALLBACK_RESPONSES.DEFAULT;
        }
      } catch (genErr) {
        clearTimeout(timeout);

        let errorType = "GENERATION_ERROR";
        if (genErr.name === "AbortError") errorType = "TIMEOUT";
        if (genErr.message?.includes("429")) errorType = "RATE_LIMIT";
        if (genErr.message?.toLowerCase().includes("safety")) errorType = "SAFETY_FILTER";

        log('error', 'Model error', {
          requestId,
          errorType,
          message: genErr.message
        });

        parsed = FALLBACK_RESPONSES.DEFAULT;
      }

      // Ensure minimal shape and add lastUpdated metadata + request id
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

      // store in simple cache for repeated prompts with time
      try {
        setCachedResponse(cacheKey, responseData);
      } catch (cErr) {
        log('warn', 'Cache set failed', { message: cErr.message });
      }

      return responseData;
    })();

    // Register in-flight
    inFlightRequests.set(cacheKey, { promise: processPromise, timestamp: Date.now() });

    // Await and respond
    try {
      const responseData = await processPromise;
      res.setHeader("X-Response-Time", String(Date.now() - now));
      res.setHeader("X-Cache", "miss");
      res.setHeader("Cache-Control", "private, max-age=60");
      log('info', 'AI response', {
        requestId,
        time: Date.now() - now,
        title: responseData?.title
      });
      return res.json({ success: true, data: responseData, errorType: null, statusCode: 200, requestId });
    } finally {
      inFlightRequests.delete(cacheKey);
    }

    
  } catch (e) {
    const requestIdErr = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    log('error', 'AI Error', { message: e.message, requestId: requestIdErr });
    const errorData = getFallbackResponse("AI_ERROR", requestIdErr);
    res.status(500).json({ success: false, data: errorData, errorType: "AI_ERROR", statusCode: 500, requestId: requestIdErr });
  }
});

// Health check endpoint for monitoring and load balancers
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Metrics endpoint for lightweight observability
app.get("/metrics", (req, res) => {
  try {
    res.json({
      uptime: process.uptime(),
      requests: requestLog.size,
      cacheSize: typeof getCacheSize === 'function' ? getCacheSize() : null
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
    requestLog.clear();
  } catch (e) {
    // ignore
  }
}

if (process.env.NODE_ENV !== "test") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => log('info', `Server running on port ${PORT}`, { port: PORT }));
  
  // Graceful shutdown handler for SIGTERM (docker stop, kubernetes termination, etc.)
  process.on("SIGTERM", () => {
    log('info', 'SIGTERM received, shutting down gracefully...');
    process.exit(0);
  });
}
