export function normalizeMessage(parsed, responseTime = null) {
  return {
    title: parsed?.title || "Response",
    steps: parsed?.steps || [],
    simple: parsed?.simple || "",
    tips: parsed?.tips || [],
    source: parsed?.source || "Election Commission of India",
    lastUpdated: parsed?.lastUpdated || new Date().toISOString(),
    _meta: { responseTime }
  };
}

export const placeholderMessage = {
  role: "bot",
  data: {
    title: "Analyzing...",
    simple: "Let me break this down for you..."
  }
};

export const errorFallbackMessage = {
  role: "bot",
  data: {
    title: "Connection Issue",
    simple: "AI unavailable. Showing verified fallback response.",
    source: "System Fallback",
    lastUpdated: new Date().toISOString()
  }
};
