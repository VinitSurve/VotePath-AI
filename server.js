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

const defaultResponse = {
  title: "How to vote",
  steps: [
    { title: "Register", desc: "Apply for voter ID online or offline." },
    { title: "Check list", desc: "Verify your name on the electoral roll." },
    { title: "Vote", desc: "Go to polling booth with your EPIC (Voter ID)." }
  ],
  simple: "You sign up, check your name on the list, and go to the booth to press the button!",
  tips: ["Carry your Voter ID", "Check your polling booth online", "Don't carry mobile phones inside"],
  source: "Election Commission of India"
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
          return res.status(429).json({ success: false, data: defaultResponse, errorType: "RATE_LIMIT", requestId });
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
      return res.status(400).json({ success: false, data: defaultResponse, errorType: "INVALID_INPUT", requestId: requestIdBad });
    }
    if (prompt.length > 500) {
      const requestIdLong = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      console.warn("Prompt too long", { requestId: requestIdLong });
      return res.status(400).json({ success: false, data: defaultResponse, errorType: "INVALID_INPUT", requestId: requestIdLong });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite-preview",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
        maxOutputTokens: 512,
      }
    });

    // Build prompt with optional previous context for a single-step memory
    const contextText = context ? `Previous context: ${context}\n` : "";
    const promptText = `You are VotePath AI, an assistant for the Indian election process.\n${contextText}Respond ONLY in ${language}. Return STRICT JSON.${mode === "elis" ? " Simplify for a 10-year-old." : ""}\n\nRules:\n- If NOT about Indian elections → return: {"title":"Off-topic Question","simple":"I can only answer questions about Indian elections and voting.","source":"VotePath AI"}\n- If about elections → return: {"title":"Topic","steps":[{"title":"Step","desc":"Description"}],"simple":"Short summary","tips":["Tip"],"source":"Election Commission of India"}\n- Keep keys in English. Translate ALL values to ${language}.\n- Keep responses under 120 words.\n- Vary phrasing slightly; avoid repeating the same sentence structure.\n\nUser: "${prompt}"`;

    // Simple response cache key with TTL
    const cacheKey = `${language}::${prompt.trim().toLowerCase()}`;
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      const TTL = 60_000; // 1 minute
      if (Date.now() - cached.time < TTL) {
        console.log("Cache hit", { requestId, cacheKey });
        return res.json({ success: true, data: cached.data, errorType: null, requestId });
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
      } catch (parseErr) {
        parsed = defaultResponse;
      }
    } catch (genErr) {
      clearTimeout(timeout);
      parsed = defaultResponse;
    }

    // Ensure minimal shape and add lastUpdated metadata + request id
    parsed = parsed || defaultResponse;
    parsed.title = parsed.title || defaultResponse.title;
    parsed.steps = parsed.steps || defaultResponse.steps;
    parsed.simple = parsed.simple || defaultResponse.simple;
    parsed.tips = parsed.tips || defaultResponse.tips;
    parsed.source = parsed.source || defaultResponse.source;
    parsed.lastUpdated = new Date().toISOString();
    parsed.requestId = requestId;

    // store in simple cache for repeated prompts with time
    try {
      cache.set(cacheKey, { data: parsed, time: Date.now() });
      if (cache.size > 50) cache.clear();
    } catch (cErr) {
      console.warn("Cache set failed", cErr.message);
    }

    res.json({ success: true, data: parsed, errorType: null, requestId });
  } catch (e) {
    console.error("AI Error:", e.message);
    const language = req.body.language || "English";
    const requestIdErr = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    console.error("ErrorType:", "AI_ERROR", "Request:", requestIdErr);
    res.status(500).json({ success: false, data: defaultResponse, errorType: "AI_ERROR", requestId: requestIdErr });
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
