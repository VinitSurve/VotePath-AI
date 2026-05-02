import { useState, useRef, useEffect, useCallback, memo } from "react";
import { useExplain } from "../context/ExplainContext";
import { Send, Bot, User, Sparkles, Mic, ShieldCheck, Volume2, VolumeX, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { askVotePathAI } from "../services/aiService";
import { languageCodeMap } from "../utils/languageMap";
import { normalizeMessage, placeholderMessage, errorFallbackMessage } from "../utils/normalizeMessage";

export default memo(function Chat() {
  const [msg, setMsg] = useState("");
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
  
  const { isELI5 } = useExplain();
  const endOfMessagesRef = useRef(null);
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

  useEffect(() => {
    const checkConnectivity = async () => {
      try {
        const res = await fetch("/health", {
          method: "HEAD",
          signal: AbortSignal.timeout(3000)
        });

        setIsServerReachable(res.ok || res.status < 500);
      } catch {
        setIsServerReachable(false);
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
    await handleSend(null, msg);
  }, [msg]);

  const handleSend = useCallback(async (e, overrideMsg = null) => {
    if (e) e.preventDefault();
    const messageToSend = overrideMsg || msg;
    if (!messageToSend.trim() || isLoading) return;
    if (!navigator.onLine) {
      setError('You are offline. Please check your connection.');
      return;
    }
    if (messageToSend.trim().length < 3) {
      setError('Please enter a meaningful question.');
      return;
    }

    const userMsg = { role: "user", text: messageToSend };
    // Instantly show user message + placeholder bot response for perceived speed
    setChat((c) => [...c, userMsg, placeholderMessage]);
    if (!overrideMsg) setMsg("");
    setIsLoading(true);
    setError(null);
    setRetryCountdown(0);
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
      } else if (lastError.message?.includes("TIMEOUT")) {
        setRetryCountdown(3);
        setError("Request timed out. Retry in 3 seconds...");
      } else {
        setError(lastError.message || "AI unavailable. Showing verified fallback response.");
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
      {/* Header */}
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

        {/* Language Selector */}
        <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-sm">
          <Globe size={16} className="text-gray-400" aria-hidden="true" />
          <select 
            value={language} 
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer"
            aria-label="Select Language"
          >
            <option value="English">English</option>
            <option value="Hindi">हिंदी (Hindi)</option>
            <option value="Marathi">मराठी (Marathi)</option>
            <option value="Tamil">தமிழ் (Tamil)</option>
          </select>
        </div>
      </div>

      {/* Chat Area */}
      {!isOnline && (
        <div className="w-full text-center text-red-600 bg-red-50 border-t border-red-100 py-2 text-sm">You are offline. Please check your connection.</div>
      )}
      <section aria-label="Chat conversation" className="flex-1 overflow-y-auto p-4 space-y-6 bg-gradient-to-b from-transparent to-gray-50/30">
        <AnimatePresence initial={false}>
          {chat.map((c, i) => {
            // Compile text for speech
            const textToSpeak = c.role === 'bot' ? `${c.data.title || ''}. ${c.data.simple || ''}` : '';

            return (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex flex-col ${c.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className={`flex max-w-[85%] ${c.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full shadow-sm ${
                    c.role === 'user' ? 'bg-gray-100 ml-3' : 'bg-primary-100 mr-3 mt-1'
                  }`}>
                    {c.role === 'user' ? <User size={16} className="text-gray-600" /> : <Bot size={16} className="text-primary-600" />}
                  </div>
                  
                  <div className={`p-5 rounded-2xl relative group ${
                    c.role === 'user' 
                      ? 'bg-primary-600 text-white rounded-tr-sm shadow-md' 
                      : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-md'
                  }`}>
                    {c.role === 'bot' && textToSpeak && (
                      <button 
                        type="button"
                        onClick={() => speakText(textToSpeak, i)}
                        className={`absolute -right-10 top-2 p-2 rounded-full transition-all ${speakingIndex === i ? 'bg-accent-100 text-accent-600 animate-pulse' : 'bg-gray-50 text-gray-400 hover:text-primary-600 opacity-0 group-hover:opacity-100'}`}
                        title="Read Aloud"
                        aria-label={speakingIndex === i ? "Stop reading" : "Read aloud"}
                      >
                        {speakingIndex === i ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
                      </button>
                    )}

                    {c.role === 'user' ? (
                      <p className="whitespace-pre-wrap leading-relaxed text-[15px]">{c.text}</p>
                    ) : (
                      <div className="space-y-4">
                        {c.data.title && <p className="font-extrabold text-xl text-gray-900 tracking-tight">{c.data.title}</p>}
                        
                        {c.data.steps && c.data.steps.length > 0 && (
                          <div className="space-y-2 mt-2">
                            {c.data.steps.map((s, idx) => (
                              <div key={idx} className="flex items-start bg-gray-50/80 p-3.5 rounded-xl border border-gray-100 hover:border-primary-100 hover:bg-primary-50/50 transition-colors">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs mr-3 mt-0.5">
                                  {idx + 1}
                                </div>
                                <div>
                                  {s.title && <strong className="block text-gray-900 font-bold mb-0.5">{s.title}</strong>}
                                  <span className="text-gray-600 text-[15px] leading-relaxed">{s.desc}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {c.data.tips && c.data.tips.length > 0 && (
                          <div className="mt-4 bg-yellow-50/80 border border-yellow-100 p-4 rounded-xl">
                            <strong className="flex items-center text-yellow-800 text-sm font-bold mb-2 uppercase tracking-wide">
                              <Sparkles size={14} className="mr-1.5" /> Important Tips
                            </strong>
                            <ul className="text-sm text-yellow-700 space-y-1.5 font-medium ml-1">
                              {c.data.tips.map((t, idx) => <li key={idx} className="flex items-start"><span className="mr-2 text-yellow-500">•</span> {t}</li>)}
                            </ul>
                          </div>
                        )}

                        {c.data.simple && (
                          <div className="mt-4 bg-accent-50/50 border-l-4 border-accent-500 pl-4 py-2 rounded-r-lg">
                            <p className="italic text-gray-700 text-[15px] font-medium leading-relaxed">
                              {c.data.simple}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                        {/* Confidence / explainability tag */}
                        {c.role === 'bot' && (
                        <div className="text-xs text-blue-500 mt-3 flex items-center" aria-hidden="true">
                          <span className="mr-1">✔</span>
                          <span>Verified guidance based on official election procedures</span>
                        </div>
                        )}
                  </div>
                </div>
                
                {c.role === 'bot' && c.data.source && (
                  <div className="flex items-center text-[11px] font-bold text-gray-400 mt-2 ml-14 bg-white/80 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-sm border border-gray-100">
                    <ShieldCheck size={12} className="text-green-500 mr-1.5" />
                    Source: {
                      (typeof c.data.source === 'string' && c.data.source.toLowerCase().includes('http')) ? (
                        <a href={c.data.source} target="_blank" rel="noreferrer" className="text-green-600 underline">{c.data.source}</a>
                      ) : c.data.source === 'Election Commission of India' ? (
                        <a href="https://eci.gov.in" target="_blank" rel="noreferrer" className="text-green-600 underline">Election Commission of India</a>
                      ) : (
                        <span>{c.data.source}</span>
                      )
                    }

                    {/* Response time and last-updated */}
                    {c.data._meta?.responseTime && (
                      <span className="text-xs text-gray-400 ml-3">⏱ {c.data._meta.responseTime}s</span>
                    )}
                    {c.data.lastUpdated && (
                      <span className="text-xs text-gray-400 ml-3">Updated as per latest public election guidelines</span>
                    )}
                    {c.data.requestId && (
                      <span className="text-[10px] text-gray-400 ml-3">ID: {c.data.requestId}</span>
                    )}
                  </div>
                )}
                {/* Rate limit / error type banner inside message */}
                {c.role === 'bot' && c.data.errorType === 'RATE_LIMIT' && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-1 mt-2 rounded-md ml-14">Too many requests. Please wait a few seconds.</div>
                )}
              </motion.div>
            );
          })}
          
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
               <div className="flex flex-row max-w-[80%] items-center">
                 <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-primary-100 mr-3 shadow-sm">
                    <Bot size={16} className="text-primary-600" />
                 </div>
                 <div className="p-4 bg-white border border-gray-100 rounded-2xl rounded-tl-sm shadow-md flex space-x-2 items-center">
                    <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                    <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                    <span className="text-sm text-gray-400 ml-2 font-medium">Processing your question...</span>
                 </div>
               </div>
            </motion.div>
          )}

          {chat.length === 0 && !isLoading && !error && (
            <div className="w-full text-center text-gray-400 mt-10">Ask anything about voting in India 🇮🇳</div>
          )}

          {chat.length === 0 && error && (
            <div className="w-full text-center text-red-500 mt-10">Unable to load assistant. Please refresh.</div>
          )}

          {error && chat.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="flex justify-center gap-2 items-center"
              role="alert"
              aria-live="polite"
              aria-atomic="true"
            >
              <div className="text-sm text-red-500 bg-red-50 border border-red-100 px-4 py-2 rounded-xl font-medium">
                ⚠️ {error}
                {retryCountdown > 0 && ` (${retryCountdown}s)`}
              </div>
              <button
                onClick={handleRetry}
                disabled={retryCountdown > 0 || isLoading}
                className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700 transition-colors"
                aria-label="Retry request"
              >
                Retry
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={endOfMessagesRef} />
      </section>

      {/* Input Area */}
      <div className="p-4 bg-white/80 backdrop-blur-md border-t border-gray-100">
        {chat.length === 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {suggestions.map((s, i) => (
              <button 
                type="button"
                key={i} 
                onClick={() => handleSend(null, s)}
                className="text-xs bg-white border border-gray-200 hover:border-primary-300 hover:bg-primary-50 text-gray-700 px-4 py-2 rounded-xl transition-all flex items-center font-bold shadow-sm hover:shadow active:scale-95"
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
            className="w-full bg-transparent text-gray-900 py-4 pl-14 pr-14 outline-none font-medium text-[15px]"
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
          <p id="helper" className="sr-only">Press Enter to send your question</p>
          <button 
            type="submit" 
            disabled={!msg.trim() || isLoading}
            className="absolute right-2 p-2.5 bg-primary-600 text-white hover:bg-primary-700 rounded-xl disabled:opacity-50 transition-all shadow-md active:scale-95 my-1"
            aria-label="Send message"
          >
            <Send size={18} aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
    </main>
  );
});
