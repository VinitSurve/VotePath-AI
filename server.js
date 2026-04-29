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

const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
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

app.post("/api/ask", async (req, res) => {
  try {
    if (!apiKey) throw new Error("No API Key");

    const { prompt, mode, language = "English" } = req.body;

    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite-preview",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const promptText = `
You are VotePath AI, an official assistant explaining the Indian election process.
You must reply ENTIRELY in the following language: ${language}.

CRITICAL INSTRUCTIONS:
1. You MUST ALWAYS output valid JSON.
2. If the user's input is NOT about Indian elections, voting, voter ID, or eligibility (for example, if they ask about math like "2+2", coding, cooking, or general knowledge), you MUST return this exact JSON structure (translated to ${language}):
{
  "title": "Off-topic Question",
  "simple": "I can only answer questions related to the Indian election process and voting. Please ask me about elections!",
  "source": "VotePath AI"
}

3. If the user's input IS about elections, answer it using this JSON structure:
{
  "title": "Main topic",
  "steps": [{"title":"Step 1", "desc":"Description"}],
  "simple": "A simple summary.",
  "tips": ["Tip 1", "Tip 2"],
  "source": "Election Commission of India"
}

4. Translate ALL content (titles, descriptions, tips, simple) to ${language}.
5. Keep the JSON keys (title, steps, simple, tips, source, desc) exactly as written in English.
6. If mode is "elis", simplify the explanation like explaining to a 10-year-old child.

User Input: "${prompt}"
`;

    const result = await model.generateContent(promptText);
    const text = result.response.text();

    res.json({ raw: text });
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
