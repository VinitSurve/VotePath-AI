/**
 * AI Service Layer
 * Encapsulates all Gemini interactions.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { log } from "../logger.js";

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

const DEFAULT_MODEL = "gemini-3.1-flash-lite-preview";
const BASE_BACKOFF_MS = 400;

class CircuitBreaker {
  constructor() {
    this.failureCount = 0;
    this.openUntil = 0;
  }

  isOpen() {
    return Date.now() < this.openUntil;
  }

  recordSuccess() {
    this.failureCount = 0;
    this.openUntil = 0;
  }

  recordFailure() {
    this.failureCount += 1;
    if (this.failureCount >= 3) {
      this.openUntil = Date.now() + 15000;
    }
  }
}

export class AIService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.genAI = new GoogleGenerativeAI(apiKey || "DUMMY_KEY");
    this.breaker = new CircuitBreaker();
  }

  sanitizePrompt(prompt) {
    return String(prompt ?? "").replace(/[{}[\]<>]/g, "");
  }

  buildPrompt({ prompt, context, language, mode }) {
    const sanitizedPrompt = this.sanitizePrompt(prompt);
    return `
You are VotePath AI, assistant for Indian elections.${mode === "elis" ? " Explain simply." : ""}

Instructions:
- IMPORTANT: Return ONLY a single valid JSON object with the exact schema described below. Do NOT include any surrounding explanation, markdown, or extra text.
- If you cannot produce valid JSON, return this exact fallback JSON object: {"title":"I can't answer that right now","steps":[],"simple":"","tips":[],"source":""}
- Respond ONLY in ${language}.
- Return JSON: {title, steps[], simple, tips[], source}
- Off-topic -> title="Off-topic Question", simple="I answer Indian election questions only."
- Elections -> steps=[{title, desc}], source="Election Commission of India"
- Translate values to ${language}, keys stay English
- Max 120 words${context ? `\nContext: ${context}` : ""}

User Input:
"""${sanitizedPrompt}"""
`;
  }

  getModel() {
    return this.genAI.getGenerativeModel({
      model: DEFAULT_MODEL,
      systemInstruction: "You are VotePath AI. ONLY answer questions about Indian elections. Refuse any other topic.",
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        maxOutputTokens: 512,
        responseMimeType: "application/json"
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
      ]
    });
  }

  async attemptGenerate({ prompt, context, language, mode, signal, stream = false }) {
    if (this.breaker.isOpen()) {
      return { success: false, data: null, errorType: "CIRCUIT_OPEN" };
    }

    const model = this.getModel();
    const promptText = this.buildPrompt({ prompt, context, language, mode });

    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), 8000);
    const mergedSignal = signal || timeoutController.signal;

    try {
      if (stream && typeof model.generateContentStream === "function") {
        const result = await model.generateContentStream(promptText, { signal: mergedSignal });
        let text = "";
        for await (const chunk of result.stream) {
          text += chunk.text();
        }
        const parsed = ResponseSchema.parse(JSON.parse(text));
        this.breaker.recordSuccess();
        return { success: true, data: parsed, errorType: null, stream: true };
      }

      const result = await model.generateContent(promptText, { signal: mergedSignal });
      const text = result.response.text();
      const parsed = ResponseSchema.parse(JSON.parse(text));
      this.breaker.recordSuccess();
      return { success: true, data: parsed, errorType: null };
    } catch (err) {
      this.breaker.recordFailure();
      let errorType = "GENERATION_ERROR";
      if (err.name === "AbortError") errorType = "TIMEOUT";
      if (String(err.message || "").includes("429")) errorType = "RATE_LIMIT";
      if (String(err.message || "").toLowerCase().includes("safety")) errorType = "SAFETY_FILTER";
      if (String(err.message || "").includes("Unexpected token") || String(err.message || "").includes("expected string")) {
        errorType = "JSON_PARSE_ERROR";
      }
      log("error", "Model error in AI service", { errorType, message: err.message });
      return { success: false, data: null, errorType };
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateAIResponse({ prompt, context = null, language = "English", mode = "normal", signal = null, stream = false }) {
    if (!this.apiKey) {
      return { success: false, data: null, errorType: "NO_API_KEY" };
    }

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      const result = await this.attemptGenerate({ prompt, context, language, mode, signal, stream });
      if (result.success || result.errorType === "CIRCUIT_OPEN") {
        return result;
      }

      const retryable = ["TIMEOUT", "RATE_LIMIT", "GENERATION_ERROR", "JSON_PARSE_ERROR"].includes(result.errorType);
      if (!retryable || attempt === maxRetries) {
        return result;
      }

      const base = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * Math.min(1000, base));
      await new Promise((resolve) => setTimeout(resolve, base + jitter));
    }

    return { success: false, data: null, errorType: "GENERATION_ERROR" };
  }

  async *generateAIStream({ prompt, context = null, language = "English", mode = "normal", signal = null }) {
    if (!this.apiKey) {
      yield { type: "error", errorType: "NO_API_KEY" };
      return;
    }

    const model = this.getModel();
    const promptText = this.buildPrompt({ prompt, context, language, mode });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const mergedSignal = signal || controller.signal;

    try {
      const result = await model.generateContentStream(promptText, { signal: mergedSignal });
      let collected = "";

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        collected += chunkText;
        yield { type: "chunk", text: chunkText };
      }

      const parsed = ResponseSchema.parse(JSON.parse(collected));
      this.breaker.recordSuccess();
      yield { type: "end", response: parsed };
    } catch (err) {
      this.breaker.recordFailure();
      let errorType = "GENERATION_ERROR";
      if (err.name === "AbortError") errorType = "TIMEOUT";
      if (String(err.message || "").includes("429")) errorType = "RATE_LIMIT";
      if (String(err.message || "").toLowerCase().includes("safety")) errorType = "SAFETY_FILTER";
      yield { type: "error", errorType, message: err.message };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export async function generateAIResponse(args) {
  const service = new AIService(process.env.GEMINI_API_KEY);
  return service.generateAIResponse(args);
}

export async function* generateAIStream(args) {
  const service = new AIService(process.env.GEMINI_API_KEY);
  yield* service.generateAIStream(args);
}
