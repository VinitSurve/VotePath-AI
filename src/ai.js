import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

export async function askAI(prompt, isELI5 = false) {
  const fallbackResponse = `**Election Information (Fallback Mode)**

Here is what you need to know:
- **Registration**: Register via Form 6 online or offline.
- **Verification**: Check your name on the Electoral Roll.
- **Voting**: Carry your EPIC (Voter ID) to the polling booth and press the button on the EVM.

*Note: Live AI responses are currently unavailable as the API key is not configured, but these official steps still apply!*`;

  const eli5Fallback = `**Voting is Easy! 🎈**

Here's how to do it:
1. **Sign Up**: Tell them you are 18!
2. **Check**: Make sure your name is on the list.
3. **Vote**: Go to the booth and press the button!

*(Psst... My brain is resting right now, but these are the right steps!)*`;

  try {
    if (!API_KEY || API_KEY === "YOUR_API_KEY_HERE") {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      return isELI5 ? eli5Fallback : fallbackResponse;
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    let finalPrompt = prompt;
    if (isELI5) {
      finalPrompt = `Explain this to me like I am a 10 year old child. Keep it very simple and fun, use emojis, and structure it well: ${prompt}`;
    }

    const result = await model.generateContent(finalPrompt);
    return result.response.text();
  } catch (error) {
    console.error("AI Error:", error);
    // Return structured fallback even on error
    return isELI5 ? eli5Fallback : fallbackResponse;
  }
}
