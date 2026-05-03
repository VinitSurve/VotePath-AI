/**
 * AI Service Layer
 * Encapsulates all Gemini API interactions
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

export class AIService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.genAI = new GoogleGenerativeAI(apiKey || "DUMMY_KEY");
  }

  buildPrompt(prompt, mode, language, context) {
    return `
You are VotePath AI, assistant for Indian elections.${mode === "elis" ? " Explain simply." : ""}

Instructions:
- IMPORTANT: Return ONLY a single valid JSON object with the exact schema described below. Do NOT include any surrounding explanation, markdown, or extra text.
- If you cannot produce valid JSON, return this exact fallback JSON object: {"title":"I can't answer that right now","steps":[],"simple":"","tips":[],"source":""}
- Respond ONLY in ${language}.
- Return JSON: {title, steps[], simple, tips[], source}
- Off-topic → title="Off-topic Question", simple="I answer Indian election questions only."
- Elections → steps=[{title, desc}], source="Election Commission of India"
- Translate values to ${language}, keys stay English
- Max 120 words${context ? `\nContext: ${context}` : ""}

User Input:
"""${prompt}"""
`;
  }

  async generateResponse(prompt, mode = "normal", language = "English", context = null) {
    if (!this.apiKey) {
      throw new Error("No API key configured");
    }

    const model = this.genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite-preview",
      systemInstruction: "You are VotePath AI. ONLY answer questions about Indian elections. Refuse any other topic.",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
        topP: 0.8,
        maxOutputTokens: 512,
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
      ]
    });

    const promptText = this.buildPrompt(prompt, mode, language, context);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const result = await model.generateContent(promptText, { signal: controller.signal });
      const text = result.response.text();

      try {
        const parsed = ResponseSchema.parse(JSON.parse(text));
        return {
          success: true,
          data: parsed,
          errorType: null
        };
      } catch (parseErr) {
        log("error", "JSON parse error in AI response", { text: text.slice(0, 100), error: parseErr.message });
        return {
          success: false,
          data: null,
          errorType: "JSON_PARSE_ERROR"
        };
      }
    } catch (err) {
      let errorType = "GENERATION_ERROR";
      if (err.name === "AbortError") errorType = "TIMEOUT";
      if (err.message?.includes("429")) errorType = "RATE_LIMIT";
      if (err.message?.toLowerCase().includes("safety")) errorType = "SAFETY_FILTER";

      log("error", "Model error in AI service", { errorType, message: err.message });
      return {
        success: false,
        data: null,
        errorType
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
