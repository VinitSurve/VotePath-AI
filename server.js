import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Fallback logic requires checking if key exists, but VITE_GEMINI_API_KEY is what the user wrote. 
// We will use both process.env.GEMINI_API_KEY and process.env.VITE_GEMINI_API_KEY
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

    const { prompt, mode } = req.body;

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro"
    });

    const system = `
You are VotePath AI, an assistant explaining the Indian election process.

CRITICAL RULES:
1. ONLY answer questions related to Indian elections, voting, voter ID, eligibility, or the political process.
2. If the user asks something completely unrelated (like math, coding, general knowledge, etc.), you MUST reply with this exact JSON:
{
  "title": "Off-topic Question",
  "simple": "I can only answer questions related to the Indian election process and voting. Please ask me about elections!",
  "source": "VotePath AI"
}
3. Always respond in valid JSON format.
4. Structure for valid election questions:
{
  "title": "Main topic",
  "steps": [{"title":"Step 1", "desc":"Description"}],
  "simple": "A very simple explanation.",
  "tips": ["Tip 1", "Tip 2"],
  "source": "Election Commission of India"
}
5. Keep language simple.
6. If mode = "elis", simplify like explaining to a 10-year-old.
`;

    const result = await model.generateContent(system + "\nUser: " + prompt);
    const text = result.response.text();

    if (!text.includes("{")) {
      return res.json({ fallback: defaultResponse });
    }

    // Clean markdown from JSON response if present
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

    res.json({ raw: cleanText });
  } catch (e) {
    console.error("AI Error:", e.message);
    res.status(500).json({
      error: "AI unavailable",
      fallback: defaultResponse
    });
  }
});

app.listen(3000, () => console.log("Server running on 3000"));
