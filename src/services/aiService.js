/**
 * VotePath AI - API Service
 * Centralized API calls for clean architecture and better maintainability.
 */

export const askVotePathAI = async (prompt, mode, language, context = null) => {
  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, mode, language, context }),
    });
    const payload = await res.json();

    // Expecting unified response: { success, data, errorType, requestId }
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid server response');
    }

    if (payload.success === false) {
      console.error('API Error:', payload.errorType, payload.requestId);
      // Still return the provided data (fallback) to the UI for graceful degradation
      return payload.data;
    }

    return payload.data;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};
