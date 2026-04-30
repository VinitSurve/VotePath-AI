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
app.use(cors());
app.use(express.json());

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

app.post("/api/ask", async (req, res) => {
  try {
    const userIP = req.ip;
    const now = Date.now();

    if (requestLog.has(userIP)) {
      const lastRequest = requestLog.get(userIP);
      if (now - lastRequest < 2000) {
        return res.status(429).json({
          error: "Too many requests. Please wait a few seconds.",
          fallback: { simple: "Too many requests. Please wait a few seconds.", source: "System" }
        });
      }
    }
    requestLog.set(userIP, now);

    if (!apiKey) throw new Error("No API Key");

    const { prompt, mode, language = "English" } = req.body;
    
    // Input sanitization
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: "Invalid prompt format" });
    }
    if (prompt.length > 500) {
      return res.status(400).json({ error: "Prompt too long (max 500 characters)" });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite-preview",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
        maxOutputTokens: 512,
      }
    });

    const promptText = `You are VotePath AI, an assistant for the Indian election process.
Respond ONLY in ${language}. Return STRICT JSON.${mode === "elis" ? " Simplify for a 10-year-old." : ""}

Rules:
- If NOT about Indian elections → return: {"title":"Off-topic Question","simple":"I can only answer questions about Indian elections and voting.","source":"VotePath AI"}
- If about elections → return: {"title":"Topic","steps":[{"title":"Step","desc":"Description"}],"simple":"Short summary","tips":["Tip"],"source":"Election Commission of India"}
- Keep keys in English. Translate ALL values to ${language}.
- Keep responses under 120 words.

User: "${prompt}"`;

    const result = await model.generateContent(promptText);
    const text = result.response.text();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = defaultResponse;
    }

    res.json(parsed);
  } catch (e) {
    console.error("AI Error:", e.message);
    const language = req.body.language || "English";
    res.status(500).json({
      error: "AI unavailable",
      fallback: {
        title: "Connection Error",
        simple: `There was an error connecting to the AI (${e.message}). Please try again later. Language requested: ${language}.`,
        source: "System"
      }
    });
  }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
