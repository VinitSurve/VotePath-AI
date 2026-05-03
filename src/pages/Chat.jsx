import { useState, useRef, useEffect, useCallback, memo } from "react";
import { useExplain } from "../context/ExplainContext";
import { Send, Bot, User, Sparkles, Mic, ShieldCheck, Volume2, VolumeX, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { askVotePathAI } from "../services/aiService";
import { languageCodeMap } from "../utils/languageMap";
import { normalizeMessage, placeholderMessage, errorFallbackMessage } from "../utils/normalizeMessage";
import ChatConversation from "../components/chat/ChatConversation";

export default memo(function Chat() {
  const [msg, setMsg] = useState("");
  const [ariaMessage, setAriaMessage] = useState("");
  const [language, setLanguage] = useState("English");
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
  const [isListening, setIsListening] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState(null);
  const [error, setError] = useState(null);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [isServerReachable, setIsServerReachable] = useState(true);
    const [showSentFeedback, setShowSentFeedback] = useState(false);
    const [showOfflineBanner, setShowOfflineBanner] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState(null);
  
  const { isELI5 } = useExplain();
  const endOfMessagesRef = useRef(null);
  const inputRef = useRef(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const scrollToBottom = () => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chat, isLoading]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (retryCountdown <= 0) return;
    const timer = setTimeout(() => setRetryCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [retryCountdown]);

  // Offline toast handling
  useEffect(() => {
    const onOffline = () => {
      setShowOfflineBanner(true);
      setAriaMessage("You are offline");
    };
    const onOnline = () => {
      setShowOfflineBanner(false);
      setError(null);
      setAriaMessage("Connection restored");
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  useEffect(() => {
    const checkConnectivity = async () => {
      try {
        const res = await fetch("/health", {
          method: "HEAD",
          signal: AbortSignal.timeout(3000)
        });

        setIsServerReachable(res.ok || res.status < 500);
        if (res.ok) setAriaMessage("Server reachable");
      } catch {
        setIsServerReachable(false);
        setAriaMessage("Server is unreachable");
      }
    };

    const interval = setInterval(checkConnectivity, 30000);

    window.addEventListener("online", checkConnectivity);
    window.addEventListener("offline", () => setIsServerReachable(false));

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", checkConnectivity);
      window.removeEventListener("offline", () => setIsServerReachable(false));
    };
  }, []);

  // Expose a manual server check for the banner retry button
  const checkServerNow = async () => {
    try {
      const res = await fetch('/health', { method: 'HEAD', signal: AbortSignal.timeout(3000) });
      const ok = res.ok || res.status < 500;
      setIsServerReachable(ok);
      setAriaMessage(ok ? 'Server reachable' : 'Server still unreachable');
      inputRef.current?.focus();
    } catch {
      setIsServerReachable(false);
      setAriaMessage('Server still unreachable');
      inputRef.current?.focus();
    }
  };

  const speakText = useCallback((text, index) => {
    if (!('speechSynthesis' in window)) return;
    
    if (speakingIndex === index) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      return;
    }

    window.speechSynthesis.cancel(); // Stop any current speech
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set language code using language map
    const langCode = languageCodeMap[language] || 'en-IN';
    utterance.lang = langCode;

    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);

    setSpeakingIndex(index);
    window.speechSynthesis.speak(utterance);
  }, [language, speakingIndex]);

  const handleRetry = useCallback(async () => {
    setError(null);
    setRetryCountdown(0);
    setIsRetrying(true);
    setAriaMessage('Retrying your request');
    try {
      await handleSend(null, msg);
    } finally {
      setIsRetrying(false);
      inputRef.current?.focus();
    }
  }, [msg]);

  const handleSend = useCallback(async (e, overrideMsg = null) => {
    if (e) e.preventDefault();
    const messageToSend = overrideMsg || msg;
    if (isLoading) return;
    if (!messageToSend.trim()) {
      setError('Please enter a question');
      setAriaMessage('Please enter a question');
      inputRef.current?.focus();
      return;
    }
    if (messageToSend.length > 500) {
      setError('Message too long (max 500 characters)');
      setAriaMessage('Message too long (max 500 characters)');
      inputRef.current?.focus();
      return;
    }
    if (!navigator.onLine) {
      setError('You are offline. Please check your connection.');
      setAriaMessage('You are offline');
      return;
    }
    if (messageToSend.trim().length < 3) {
      setError('Please enter a meaningful question.');
      setAriaMessage('Please enter a meaningful question');
      return;
    }

    const userMsg = { role: "user", text: messageToSend };
    // Instantly show user message + placeholder bot response for perceived speed
    setChat((c) => [...c, userMsg, placeholderMessage]);
    if (!overrideMsg) setMsg("");
    setIsLoading(true);
    setError(null);
    setRetryCountdown(0);
      setShowSentFeedback(true);
      setAriaMessage('Message sent');
      setTimeout(() => setShowSentFeedback(false), 2000);
    const start = Date.now();
    // include last message content as simple one-step context
    const lastMessage = (chat[chat.length - 1] && chat[chat.length - 1].role === 'user') ? chat[chat.length - 1].text : (chat[chat.length - 1] && chat[chat.length - 1].role === 'bot' ? chat[chat.length - 1].data.simple : "");
    
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
        const parsed = await askVotePathAI(messageToSend, isELI5 ? "elis" : "normal", language, lastMessage);

        const timeTaken = ((Date.now() - start) / 1000).toFixed(1);

        // Normalize response shape to avoid UI breakage
        const safeData = normalizeMessage(parsed, timeTaken);

        // Replace the placeholder with real response (safe data)
        setChat((c) => {
          const updated = [...c];
          updated[updated.length - 1] = { role: "bot", data: safeData };
          return updated;
        });

        lastError = null;
        break;
      } catch (err) {
        lastError = err;

        const isRetryable =
          err.message?.includes("TIMEOUT") ||
          err.message?.includes("RETRY_AFTER") ||
          err.message?.includes("503");

          if (isRetryable && attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt - 1) * 1000;

          console.log("Retrying", {
            attempt,
            backoffMs,
            error: err.message
          });

          // announce retry and wait
          setAriaMessage('Retrying your request');
          await new Promise(r => setTimeout(r, backoffMs));
          continue;
        }

        break;
      }
    }

    if (lastError) {
      // Set retry countdown for rate limit errors
      if (lastError.message?.includes("429")) {
        setRetryCountdown(2);
        setError("Too many requests. Retry in 2 seconds...");
        setAriaMessage('Retry failed, please try again');
      } else if (lastError.message?.includes("TIMEOUT")) {
        setRetryCountdown(3);
        setError("Request timed out. Retry in 3 seconds...");
        setAriaMessage('Retry failed, please try again');
      } else {
        setError(lastError.message || "Something went wrong. Try again or check your connection.");
        setAriaMessage('Something went wrong. Try again or check your connection.');
      }

      // Replace placeholder with error fallback
      setChat((c) => {
        const updated = [...c];
        updated[updated.length - 1] = errorFallbackMessage;
        return updated;
      });
    }

    setIsLoading(false);
  }, [msg, isLoading, isELI5, language]);

  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    
    // Set language code using language map
    const langCode = languageCodeMap[language] || 'en-IN';
    recognition.lang = langCode;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => setMsg(event.results[0][0].transcript);
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
  }, [language]);

  const suggestions = [
    "What documents do I need to vote?",
    "Generate my voting checklist",
    "How do I find my polling booth?"
  ];

  return (
    <main role="main">
      <div tabIndex="0" className="max-w-3xl mx-auto h-[85vh] flex flex-col bg-gradient-to-br from-indigo-50 via-white to-blue-50 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 overflow-hidden relative">
        <div aria-live="polite" role="status" className="sr-only">{ariaMessage}</div>
        <div className="bg-white/50 p-4 border-b border-gray-100 flex items-center justify-between backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="bg-primary-100 p-2 rounded-2xl shadow-inner">
              <Bot className="text-primary-600" size={24} />
              <div className="text-[10px] text-gray-400">System status: {isLoading ? 'Processing' : 'Ready'}</div>
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-lg">VotePath AI</h2>
              <p className="text-xs text-primary-600 font-medium tracking-wide">Multi-Language Support</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-sm">
            <Globe size={16} className="text-gray-400" aria-hidden="true" />
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer" aria-label="Select Language">
              <option value="English">English</option>
              <option value="Hindi">हिंदी (Hindi)</option>
              <option value="Marathi">मराठी (Marathi)</option>
              <option value="Tamil">தமிழ் (Tamil)</option>
            </select>
          </div>
        </div>

        {!isOnline && <div className="w-full text-center text-red-600 bg-red-50 border-t border-red-100 py-2 text-sm">You are offline. Please check your connection.</div>}
        {isOnline && !isServerReachable && (
          <div role="alert" className="w-full text-center text-orange-600 bg-orange-50 border-t border-orange-100 py-2 text-sm">
            ⚠️ Server is unreachable. Your messages may not be sent.
            <button onClick={checkServerNow} className="ml-3 px-3 py-1 bg-orange-600 text-white rounded-md text-xs focus:ring-2 focus:ring-primary-500">Retry</button>
          </div>
        )}

        <ChatConversation
          chat={chat}
          isLoading={isLoading}
          error={error}
          retryCountdown={retryCountdown}
          onRetry={handleRetry}
          isRetrying={isRetrying}
          onSpeak={speakText}
          speakingIndex={speakingIndex}
          copiedIndex={copiedIndex}
          onCopy={(index) => {
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 2000);
          }}
          endOfMessagesRef={endOfMessagesRef}
        />

      {/* Input Area */}
      <div className="p-4 bg-white/80 backdrop-blur-md border-t border-gray-100">
        {chat.length === 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {suggestions.map((s, i) => (
              <button 
                type="button"
                key={i} 
                onClick={() => handleSend(null, s)}
                className="text-xs bg-white border border-gray-200 hover:border-primary-300 hover:bg-primary-50 text-gray-700 px-4 py-2 rounded-xl transition-all flex items-center font-bold shadow-sm hover:shadow active:scale-95 hover:scale-105 cursor-pointer focus:ring-2 focus:ring-primary-500"
              >
                <Sparkles size={14} className="mr-1.5 text-primary-500" /> {s}
              </button>
            ))}
            
            {/* Dedicated Smart Checklist Button */}
            <button 
                type="button"
                onClick={() => {
                  const age = prompt("How old are you?");
                  if(age) handleSend(null, `I am ${age} years old. Generate my personalized voting checklist.`);
                }}
                className="text-xs bg-accent-50 border border-accent-200 hover:border-accent-400 hover:bg-accent-100 text-accent-800 px-4 py-2 rounded-xl transition-all flex items-center font-bold shadow-sm hover:shadow active:scale-95"
              >
                📝 Personalized Checklist
              </button>
          </div>
        )}
        <form onSubmit={handleSend} className="relative flex items-center bg-gray-50 rounded-2xl focus-within:ring-4 focus-within:ring-primary-500/20 transition-all border border-gray-200 focus-within:border-primary-400 shadow-inner">
          <button
            type="button"
            onClick={startListening}
            className={`absolute left-2 p-2 rounded-xl transition-colors ${isListening ? 'text-red-500 bg-red-100 animate-pulse' : 'text-gray-400 hover:text-primary-600 hover:bg-white'}`}
            title="Use Voice Input"
            aria-label={isListening ? "Stop listening" : "Start voice input"}
          >
            <Mic size={22} aria-hidden="true" />
          </button>
          <label htmlFor="chat-input" className="sr-only">Ask about voting</label>
          <input
            type="text"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder={isListening ? "Listening..." : "Ask VotePath AI..."}
            className="w-full bg-transparent text-gray-900 py-4 pl-14 pr-14 outline-none font-medium text-[15px] focus:ring-2 focus:ring-primary-500"
            id="chat-input"
            disabled={isLoading || isListening}
            aria-label="Enter your question"
            aria-describedby="helper"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                handleSend(e);
              }
            }}
          />
          <p id="helper" className="text-xs text-gray-500 ml-2">Press Enter to send</p>
          {/* Input disabled reason */}
          {(isLoading || isListening) && (
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-6 text-xs text-gray-500">Waiting for AI response...</div>
          )}
          <button 
            type="submit" 
            disabled={!msg.trim() || isLoading}
              className="absolute right-2 p-2.5 bg-primary-600 text-white hover:bg-primary-700 rounded-xl disabled:opacity-40 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all shadow-md active:scale-95 my-1 focus:ring-2 focus:ring-primary-500"
            aria-label="Send message"
          >
            <Send size={18} aria-hidden="true" />
          </button>
        </form>
      </div>
      {/* Sticky loader near input to keep loading visible while scrolling */}
      <AnimatePresence>
        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed bottom-28 left-1/2 -translate-x-1/2 bg-white/90 px-3 py-2 rounded-full shadow-lg z-50 flex items-center space-x-2" aria-live="polite">
            <div className="w-3 h-3 bg-primary-400 rounded-full animate-pulse" />
            <div className="text-sm text-gray-700">Processing your question...</div>
          </motion.div>
        )}
        {showOfflineBanner && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed top-20 left-1/2 -translate-x-1/2 bg-red-600 text-white px-3 py-2 rounded-md shadow-lg z-50">
            You are offline
          </motion.div>
        )}
      </AnimatePresence>
      
        {/* Sent feedback toast */}
        <AnimatePresence>
          {showSentFeedback && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg"
            >
              ✓ Message sent
            </motion.div>
          )}
        </AnimatePresence>
    </div>
    </main>
  );
});
