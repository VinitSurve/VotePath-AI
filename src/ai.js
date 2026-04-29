import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "YOUR_API_KEY_HERE";
const genAI = new GoogleGenerativeAI(API_KEY);

export async function askAI(prompt, isELI5 = false) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    let finalPrompt = prompt;
    if (isELI5) {
      finalPrompt = `Explain this to me like I am a 10 year old child. Keep it very simple and fun: ${prompt}`;
    }

    const result = await model.generateContent(finalPrompt);
    return result.response.text();
  } catch (error) {
    console.error("AI Error:", error);
    return "I'm sorry, I couldn't connect to my brain right now. Please check your internet connection or API key.";
  }
}
