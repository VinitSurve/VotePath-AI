import { useState, useRef, useEffect } from "react";
import { useExplain } from "../context/ExplainContext";
import { Send, Bot, User, Sparkles, Mic, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Chat() {
  const [msg, setMsg] = useState("");
  const [chat, setChat] = useState([
    {
      role: "bot",
      data: {
        title: "Namaste! I'm VotePath AI.",
        simple: "Ask me anything about elections, voting, or your eligibility!",
        source: "VotePath Assistant"
      }
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const { isELI5 } = useExplain();
  const endOfMessagesRef = useRef(null);

  const scrollToBottom = () => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chat, isLoading]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!msg.trim() || isLoading) return;

    const userMsg = { role: "user", text: msg };
    setChat((c) => [...c, userMsg]);
    setMsg("");
    setIsLoading(true);

    try {
      const res = await fetch("http://localhost:3000/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userMsg.text, mode: isELI5 ? "elis" : "normal" })
      });

      const data = await res.json();
      let parsed;

      try {
        parsed = JSON.parse(data.raw);
      } catch {
        parsed = data.fallback || { simple: "Sorry, I couldn't understand the format." };
      }

      setChat((c) => [...c, { role: "bot", data: parsed }]);
    } catch {
      setChat((c) => [
        ...c,
        { role: "bot", data: { simple: "Something went wrong. Please check if the AI server is running." } }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-IN';

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => setMsg(event.results[0][0].transcript);
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  const suggestions = [
    "Generate my voting checklist",
    "What documents do I need?",
    "Explain this election news in simple terms"
  ];

  return (
    <div className="max-w-3xl mx-auto h-[80vh] flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-primary-50 p-4 border-b border-gray-200 flex items-center space-x-3">
        <div className="bg-primary-100 p-2 rounded-full">
          <Bot className="text-primary-600" size={24} />
        </div>
        <div>
          <h2 className="font-bold text-gray-900">VotePath AI Assistant</h2>
          <p className="text-xs text-gray-500">Powered by Gemini AI</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/50">
        <AnimatePresence initial={false}>
          {chat.map((c, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${c.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className={`flex max-w-[85%] ${c.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full ${
                  c.role === 'user' ? 'bg-gray-200 ml-2' : 'bg-primary-100 mr-2 mt-1'
                }`}>
                  {c.role === 'user' ? <User size={16} className="text-gray-600" /> : <Bot size={16} className="text-primary-600" />}
                </div>
                <div className={`p-4 rounded-2xl ${
                  c.role === 'user' 
                    ? 'bg-primary-600 text-white rounded-tr-sm' 
                    : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
                }`}>
                  {c.role === 'user' ? (
                    <p className="whitespace-pre-wrap leading-relaxed text-sm">{c.text}</p>
                  ) : (
                    <div className="space-y-3">
                      {c.data.title && <p className="font-bold text-lg text-primary-900">{c.data.title}</p>}
                      
                      {c.data.steps && c.data.steps.length > 0 && (
                        <ul className="space-y-2 mt-2">
                          {c.data.steps.map((s, idx) => (
                            <li key={idx} className="flex items-start bg-gray-50 p-3 rounded-xl border border-gray-100">
                              <span className="text-primary-500 font-bold mr-2 mt-0.5">•</span>
                              <div>
                                {s.title && <strong className="block text-gray-900">{s.title}</strong>}
                                <span className="text-gray-700 text-sm">{s.desc}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}

                      {c.data.tips && c.data.tips.length > 0 && (
                        <div className="mt-3 bg-yellow-50 border border-yellow-100 p-3 rounded-xl">
                          <strong className="text-yellow-800 text-sm block mb-1">💡 Tips:</strong>
                          <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                            {c.data.tips.map((t, idx) => <li key={idx}>{t}</li>)}
                          </ul>
                        </div>
                      )}

                      {c.data.simple && (
                        <p className="mt-3 italic text-gray-600 text-sm bg-gray-50 border-l-4 border-primary-500 pl-3 py-1">
                          {c.data.simple}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Trust Layer for Bot Responses */}
              {c.role === 'bot' && c.data.source && (
                <div className="flex items-center text-[10px] text-gray-400 mt-2 ml-11 bg-white px-2 py-1 rounded-full shadow-sm border border-gray-100">
                  <ShieldCheck size={12} className="text-green-500 mr-1" />
                  Source: {c.data.source}
                </div>
              )}
            </motion.div>
          ))}
          
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
               <div className="flex flex-row max-w-[80%]">
                 <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-primary-100 mr-2">
                    <Bot size={16} className="text-primary-600" />
                 </div>
                 <div className="p-4 bg-white border border-gray-200 rounded-2xl rounded-tl-sm shadow-sm flex space-x-1 items-center h-12">
                    <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                 </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={endOfMessagesRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-200">
        {chat.length === 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {suggestions.map((s, i) => (
              <button 
                key={i} 
                onClick={() => setMsg(s)}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-colors flex items-center font-medium shadow-sm"
              >
                <Sparkles size={12} className="mr-1 text-primary-500" /> {s}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={handleSend} className="relative flex items-center bg-gray-100 rounded-xl focus-within:ring-2 focus-within:ring-primary-500 transition-all border border-transparent shadow-inner">
          <button
            type="button"
            onClick={startListening}
            className={`absolute left-2 p-2 rounded-lg transition-colors ${isListening ? 'text-red-500 bg-red-50 animate-pulse' : 'text-gray-400 hover:text-primary-600 hover:bg-white'}`}
            title="Use Voice Input"
          >
            <Mic size={20} />
          </button>
          <input
            type="text"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder={isListening ? "Listening..." : "Ask VotePath AI..."}
            className="w-full bg-transparent text-gray-900 py-4 pl-12 pr-12 outline-none"
            disabled={isLoading || isListening}
          />
          <button 
            type="submit" 
            disabled={!msg.trim() || isLoading}
            className="absolute right-2 p-2 text-primary-600 hover:bg-primary-50 rounded-lg disabled:opacity-50 transition-colors bg-white shadow-sm my-1"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
