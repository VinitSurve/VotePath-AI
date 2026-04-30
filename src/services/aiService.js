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
    
    // Return the pre-parsed JSON from the server, or use the fallback if it failed
    return data.fallback ? data.fallback : data;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};
