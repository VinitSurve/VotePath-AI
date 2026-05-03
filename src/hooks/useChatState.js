import { useCallback, useRef, useState } from "react";
import { askVotePathAI } from "../services/aiService";
import { normalizeMessage, placeholderMessage, errorFallbackMessage } from "../utils/normalizeMessage";

export function useChatState(isELI5, language, setAriaMessage) {
  const [msg, setMsg] = useState("");
  const [chat, setChat] = useState([
    {
      role: "bot",
      data: {
        title: "Namaste! I'm VotePath AI.",
        simple: "Ask me anything about elections, voting, or your eligibility in English, Hindi, Marathi, or Tamil!",
        source: "VotePath Assistant"
      }
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showSentFeedback, setShowSentFeedback] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const chatRef = useRef(chat);

  chatRef.current = chat;

  const updateChat = useCallback((updater) => {
    setChat((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      chatRef.current = next;
      return next;
    });
  }, []);

  const sendMessage = useCallback(async (overrideMsg = null) => {
    const messageToSend = overrideMsg || msg;
    if (isLoading) return;
    if (!messageToSend.trim()) {
      setError("Please enter a question");
      setAriaMessage("Please enter a question");
      return;
    }
    if (messageToSend.length > 500) {
      setError("Message too long (max 500 characters)");
      setAriaMessage("Message too long (max 500 characters)");
      return;
    }
    if (!navigator.onLine) {
      setError("You are offline. Please check your connection.");
      setAriaMessage("You are offline");
      return;
    }
    if (messageToSend.trim().length < 3) {
      setError("Please enter a meaningful question.");
      setAriaMessage("Please enter a meaningful question");
      return;
    }

    const userMsg = { role: "user", text: messageToSend };
    updateChat((current) => [...current, userMsg, placeholderMessage]);
    if (!overrideMsg) setMsg("");
    setIsLoading(true);
    setError(null);
    setRetryCountdown(0);
    setShowSentFeedback(true);
    setAriaMessage("Message sent");
    setTimeout(() => setShowSentFeedback(false), 2000);

    const start = Date.now();
    const lastMessage = chatRef.current.at(-1);
    const lastMessageContent = lastMessage && lastMessage.role === "user"
      ? lastMessage.text
      : lastMessage && lastMessage.role === "bot"
        ? lastMessage.data.simple
        : "";

    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        const parsed = await askVotePathAI(messageToSend, isELI5 ? "elis" : "normal", language, lastMessageContent);
        const timeTaken = ((Date.now() - start) / 1000).toFixed(1);
        const safeData = normalizeMessage(parsed, timeTaken);

        updateChat((current) => {
          const next = [...current];
          next[next.length - 1] = { role: "bot", data: safeData };
          return next;
        });

        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        const isRetryable = err.message?.includes("TIMEOUT") || err.message?.includes("RETRY_AFTER") || err.message?.includes("503");
        if (isRetryable && attempt < maxRetries) {
          // Exponential backoff with jitter: base * 2^(attempt-1) + random(0, base)
          const baseMs = Math.pow(2, attempt - 1) * 1000;
          const jitterMs = Math.random() * Math.min(1000, baseMs); // Jitter up to base or 1 second
          const backoffMs = baseMs + jitterMs;
          setAriaMessage(`Retrying your request in ${Math.ceil(backoffMs / 1000)}s`);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }
        break;
      }
    }

    if (lastError) {
      if (lastError.message?.includes("429")) {
        setRetryCountdown(2);
        setError("Too many requests. Retry in 2 seconds...");
        setAriaMessage("Retry failed, please try again");
      } else if (lastError.message?.includes("TIMEOUT")) {
        setRetryCountdown(3);
        setError("Request timed out. Retry in 3 seconds...");
        setAriaMessage("Retry failed, please try again");
      } else {
        setError(lastError.message || "Something went wrong. Try again or check your connection.");
        setAriaMessage("Something went wrong. Try again or check your connection.");
      }

      updateChat((current) => {
        const next = [...current];
        next[next.length - 1] = errorFallbackMessage;
        return next;
      });
    }

    setIsLoading(false);
  }, [isELI5, isLoading, language, msg, setAriaMessage, updateChat]);

  const handleRetry = useCallback(async () => {
    setError(null);
    setRetryCountdown(0);
    setIsRetrying(true);
    setAriaMessage("Retrying your request");
    try {
      await sendMessage(msg);
    } finally {
      setIsRetrying(false);
    }
  }, [msg, sendMessage, setAriaMessage]);

  return {
    msg,
    setMsg,
    chat,
    isLoading,
    error,
    retryCountdown,
    isRetrying,
    showSentFeedback,
    copiedIndex,
    setCopiedIndex,
    setRetryCountdown,
    setError,
    setIsLoading,
    sendMessage,
    handleRetry
  };
}
