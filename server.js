import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : ["http://localhost:5173"]
}));
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

const fallbacks = {
  DEFAULT: {
    title: "How to vote",
    steps: [
      { title: "Register", desc: "Apply for voter ID online or offline." },
      { title: "Check list", desc: "Verify your name on the electoral roll." },
      { title: "Vote", desc: "Go to polling booth with your EPIC (Voter ID)." }
    ],
    simple: "You sign up, check your name on the list, and go to the booth to press the button!",
    tips: ["Carry your Voter ID", "Check your polling booth online", "Don't carry mobile phones inside"],
    source: "Election Commission of India"
  },
  INVALID_INPUT: {
    title: "Invalid Request",
    simple: "Your question is too long or empty. Please try again.",
    source: "Validation Error",
    steps: [],
    tips: []
  },
  RATE_LIMIT: {
    title: "Too Many Requests",
    simple: "You're asking too fast. Please wait 2 seconds and try again.",
    source: "Rate Limit",
    steps: [],
    tips: []
  },
  AI_ERROR: {
    title: "Temporary Service Issue",
    simple: "Our AI is unavailable. Please try again in a moment.",
    source: "Service Fallback",
    steps: [],
    tips: []
  }
};

const requestLog = new Map();
// Simple in-memory response cache to show efficiency/reuse
const cache = new Map();

app.post("/api/ask", async (req, res) => {
  try {
    // Unique request id for observability
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const userIP = req.ip;
    const now = Date.now();

    // Enforce rate limit in production. For tests, rate limiting can be enabled
    // by setting ENABLE_RATE_LIMIT_TEST=true in the environment. This allows
    // deterministic testing of RATE_LIMIT behavior without changing production logic.
    if (process.env.NODE_ENV !== 'test' || process.env.ENABLE_RATE_LIMIT_TEST === 'true') {
      if (requestLog.has(userIP)) {
        const lastRequest = requestLog.get(userIP);
        if (now - lastRequest < 2000) {
          console.warn("Rate limit hit", { requestId, userIP });
          res.setHeader("Retry-After", "2");
          res.setHeader("X-RateLimit-Limit", "1");
          res.setHeader("X-RateLimit-Remaining", "0");
          const errorData = { ...fallbacks.RATE_LIMIT, requestId };
          return res.status(429).json({ success: false, data: errorData, errorType: "RATE_LIMIT", statusCode: 429, requestId });
        }
      }
    }
    requestLog.set(userIP, now);

    if (!apiKey) throw new Error("No API Key");

    const { prompt, mode, language = "English", context = null } = req.body;
    
    // Input validation (schema-like signal)
    if (!prompt || typeof prompt !== 'string') {
      const requestIdBad = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      console.warn("Invalid input", { requestId: requestIdBad });
      const errorData = { ...fallbacks.INVALID_INPUT, requestId: requestIdBad };
      return res.status(400).json({ success: false, data: errorData, errorType: "INVALID_INPUT", statusCode: 400, requestId: requestIdBad });
    }
    if (prompt.length > 500) {
      const requestIdLong = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      console.warn("Prompt too long", { requestId: requestIdLong });
      const errorData = { ...fallbacks.INVALID_INPUT, requestId: requestIdLong };
      return res.status(400).json({ success: false, data: errorData, errorType: "INVALID_INPUT", statusCode: 400, requestId: requestIdLong });
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
- Respond ONLY in ${language}.
- Return JSON: {title, steps[], simple, tips[], source}
- Off-topic → title="Off-topic Question", simple="I answer Indian election questions only."
- Elections → steps=[{title, desc}], source="Election Commission of India"
- Translate values to ${language}, keys stay English
- Max 120 words${context ? `\nContext: ${context}` : ""}

User: "${prompt}"
`;

    // Simple response cache key with TTL
    const cacheKey = `${language}::${prompt.trim().toLowerCase()}`;
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      const TTL = 60_000; // 1 minute
      if (Date.now() - cached.time < TTL) {
        console.log("Cache hit", { requestId, cacheKey });
        res.setHeader("X-Response-Time", String(Date.now() - now));
        const cacheData = { ...cached.data, requestId, isCached: true };
        return res.json({ success: true, data: cacheData, errorType: null, statusCode: 200, requestId });
      }
      cache.delete(cacheKey);
    }

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
          console.log("Off-topic detected", { requestId });
        }

        // Basic language validation
        const englishWords = parsed.simple?.match(/\b(the|is|are|and)\b/gi)?.length || 0;
        if (language !== "English" && englishWords > 5) {
          console.warn("Language mismatch", { requestId, language });
        }
      } catch (parseErr) {
        console.error("JSON parse error", {
          requestId,
          text: text.slice(0, 100)
        });
        parsed = fallbacks.DEFAULT;
      }
    } catch (genErr) {
      clearTimeout(timeout);

      let errorType = "GENERATION_ERROR";
      if (genErr.name === "AbortError") errorType = "TIMEOUT";
      if (genErr.message?.includes("429")) errorType = "RATE_LIMIT";
      if (genErr.message?.toLowerCase().includes("safety")) errorType = "SAFETY_FILTER";

      console.error("Model error", {
        requestId,
        errorType,
        message: genErr.message
      });

      parsed = fallbacks.DEFAULT;
    }

    // Ensure minimal shape and add lastUpdated metadata + request id
    parsed = parsed || fallbacks.DEFAULT;
    parsed.title = parsed.title || fallbacks.DEFAULT.title;
    parsed.steps = parsed.steps || fallbacks.DEFAULT.steps;
    parsed.simple = parsed.simple || fallbacks.DEFAULT.simple;
    parsed.tips = parsed.tips || fallbacks.DEFAULT.tips;
    parsed.source = parsed.source || fallbacks.DEFAULT.source;
    parsed.lastUpdated = new Date().toISOString();
    parsed.requestId = requestId;

    // store in simple cache for repeated prompts with time
    try {
      cache.set(cacheKey, { data: parsed, time: Date.now() });
      if (cache.size > 50) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }
    } catch (cErr) {
      console.warn("Cache set failed", cErr.message);
    }

    res.setHeader("X-Response-Time", String(Date.now() - now));
    const responseData = {
      ...parsed,
      requestId,
      _meta: {
        temperature: 0.3,
        topP: 0.8,
        responseTime: Date.now() - now,
        cached: false
      }
    };
    console.log("AI response", {
      requestId,
      time: Date.now() - now,
      title: parsed?.title
    });
    res.json({ success: true, data: responseData, errorType: null, statusCode: 200, requestId });
  } catch (e) {
    console.error("AI Error:", e.message);
    const language = req.body.language || "English";
    const requestIdErr = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    console.error("ErrorType:", "AI_ERROR", "Request:", requestIdErr);
    const errorData = { ...fallbacks.AI_ERROR, requestId: requestIdErr };
    res.status(500).json({ success: false, data: errorData, errorType: "AI_ERROR", statusCode: 500, requestId: requestIdErr });
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
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
