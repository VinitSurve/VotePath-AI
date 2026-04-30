/**
 * VotePath AI - API Service
 * Centralized API calls for clean architecture and better maintainability.
 */

export const askVotePathAI = async (prompt, mode, language) => {
  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, mode, language }),
    });

    const data = await res.json();

    if (!res.ok && !data.fallback) {
      throw new Error(`Server error: ${res.status}`);
    }
    
    // Parse the structured JSON response from Gemini
    try {
      if (data.raw) {
        return JSON.parse(data.raw);
      }
      return data.fallback;
    } catch {
      return data.fallback || { simple: "Sorry, I couldn't understand the format." };
    }
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};
