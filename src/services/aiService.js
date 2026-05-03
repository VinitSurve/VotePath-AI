/**
 * VotePath AI - API Service
 * Centralized API calls for clean architecture and better maintainability.
 */

export const askVotePathAI = async (prompt, mode, language, context = null) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt, mode, language, context }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const payload = await res.json();

    // Expecting unified response: { success, data, errorType, requestId }
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid server response');
    }

    if (!res.ok) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "2") * 1000;
      const retryableStatus = [408, 429, 500, 502, 503, 504];

      if (retryableStatus.includes(res.status)) {
        throw new Error(`RETRY_AFTER_${retryAfter}`);
      }
    }

    if (payload.success === false) {
      console.error('API Error:', payload.errorType, payload.requestId);
      // Still return the provided data (fallback) to the UI for graceful degradation
      return payload.data;
    }

    return payload.data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      console.error("API Timeout", { error: error.message });
      throw new Error("TIMEOUT");
    }

    console.error("API Error:", error);
    throw error;
  }
};
