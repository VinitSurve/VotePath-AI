/**
 * Error Fallback Responses
 * Centralized error message definitions for consistency
 */

export const FALLBACK_RESPONSES = {
  DEFAULT: {
    title: "How to vote",
    steps: [
      { title: "Register", desc: "Apply for voter ID online or offline." },
      { title: "Check list", desc: "Verify your name on the electoral roll." },
      { title: "Vote", desc: "Go to polling booth with your EPIC (Voter ID)." }
    ],
    simple: "You sign up, check your name on the list, and go to the booth to press the button!",
    tips: ["Carry your Voter ID", "Check your polling booth online", "Don't carry mobile phones inside"],
    source: "Election Commission of India"
  },

  INVALID_INPUT: {
    title: "Invalid Request",
    simple: "Your question is too long or empty. Please try again.",
    source: "Validation Error",
    steps: [],
    tips: []
  },

  RATE_LIMIT: {
    title: "Too Many Requests",
    simple: "You're asking too fast. Please wait 2 seconds and try again.",
    source: "Rate Limit",
    steps: [],
    tips: []
  },

  AI_ERROR: {
    title: "Temporary Service Issue",
    simple: "Our AI is unavailable. Please try again in a moment.",
    source: "Service Fallback",
    steps: [],
    tips: []
  }
};

/**
 * Get fallback response for error type
 * @param {string} errorType - One of: DEFAULT, INVALID_INPUT, RATE_LIMIT, AI_ERROR
 * @param {string} requestId - Request ID for tracking
 * @returns {object} Fallback response with _meta
 */
export function getFallbackResponse(errorType, requestId) {
  const base = FALLBACK_RESPONSES[errorType] || FALLBACK_RESPONSES.DEFAULT;

  return {
    ...base,
    requestId,
    _meta: {
      errorType: errorType || "DEFAULT",
      retryable: ['RATE_LIMIT', 'AI_ERROR'].includes(errorType),
      retryAfterMs: errorType === 'RATE_LIMIT' ? 2000 : 0
    }
  };
}
