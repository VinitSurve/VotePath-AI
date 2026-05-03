import { useEffect, useRef, useState, memo } from "react";
import { useExplain } from "../context/ExplainContext";
import { Send, Bot, Sparkles, Mic, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ChatConversation from "../components/chat/ChatConversation";
import { useChatState } from "../hooks/useChatState";
import { useConnectivity } from "../hooks/useConnectivity";
import { useSpeech } from "../hooks/useSpeech";

export default memo(function Chat() {
  const { isELI5 } = useExplain();
  const [language, setLanguage] = useState("English");
  const inputRef = useRef(null);
  const endOfMessagesRef = useRef(null);

  const {
    isOnline,
    isServerReachable,
    showOfflineBanner,
    ariaMessage,
    setAriaMessage,
    checkServerNow
  } = useConnectivity();

  const {
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
    sendMessage,
    handleRetry
  } = useChatState(isELI5, language, setAriaMessage);

  const {
    speakingIndex,
    isListening,
    speakText,
    startListening
  } = useSpeech(language);

  const scrollToBottom = () => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chat, isLoading]);

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
              <div className="text-[10px] text-gray-400">System status: {isLoading ? "Processing" : "Ready"}</div>
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
            <button onClick={() => checkServerNow(inputRef.current)} className="ml-3 px-3 py-1 bg-orange-600 text-white rounded-md text-xs focus:ring-2 focus:ring-primary-500">Retry</button>
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

        <div className="p-4 bg-white/80 backdrop-blur-md border-t border-gray-100">
          {chat.length === 1 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {suggestions.map((s, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="text-xs bg-white border border-gray-200 hover:border-primary-300 hover:bg-primary-50 text-gray-700 px-4 py-2 rounded-xl transition-all flex items-center font-bold shadow-sm hover:shadow active:scale-95 hover:scale-105 cursor-pointer focus:ring-2 focus:ring-primary-500"
                >
                  <Sparkles size={14} className="mr-1.5 text-primary-500" /> {s}
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  const age = prompt("How old are you?");
                  if (age) sendMessage(`I am ${age} years old. Generate my personalized voting checklist.`);
                }}
                className="text-xs bg-accent-50 border border-accent-200 hover:border-accent-400 hover:bg-accent-100 text-accent-800 px-4 py-2 rounded-xl transition-all flex items-center font-bold shadow-sm hover:shadow active:scale-95"
              >
                📝 Personalized Checklist
              </button>
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="relative flex items-center bg-gray-50 rounded-2xl focus-within:ring-4 focus-within:ring-primary-500/20 transition-all border border-gray-200 focus-within:border-primary-400 shadow-inner">
            <button
              type="button"
              onClick={() => startListening((transcript) => setMsg(transcript))}
              className={`absolute left-2 p-2 rounded-xl transition-colors ${isListening ? "text-red-500 bg-red-100 animate-pulse" : "text-gray-400 hover:text-primary-600 hover:bg-white"}`}
              title="Use Voice Input"
              aria-label={isListening ? "Stop listening" : "Start voice input"}
            >
              <Mic size={22} aria-hidden="true" />
            </button>
            <label htmlFor="chat-input" className="sr-only">Ask about voting</label>
            <input
              ref={inputRef}
              type="text"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder={isListening ? "Listening..." : "Ask VotePath AI..."}
              className="w-full bg-transparent text-gray-900 py-4 pl-14 pr-14 outline-none font-medium text-[15px] focus:ring-2 focus:ring-primary-500"
              id="chat-input"
              disabled={isLoading || isListening}
              aria-label="Enter your question"
              aria-describedby="helper"
            />
            <p id="helper" className="text-xs text-gray-500 ml-2">Press Enter to send</p>
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
