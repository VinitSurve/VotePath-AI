import { useState, useRef, useEffect } from 'react';
import { askAI } from '../ai';
import { useExplain } from '../context/ExplainContext';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Chat() {
  const [msg, setMsg] = useState("");
  const [chat, setChat] = useState([
    { role: 'bot', text: "Namaste! I'm VotePath AI. Ask me anything about elections, voting, or your eligibility!" }
  ]);
  const [isLoading, setIsLoading] = useState(false);
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

    const userMsg = msg;
    setMsg("");
    setChat(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const res = await askAI(userMsg, isELI5);
      setChat(prev => [...prev, { role: 'bot', text: res }]);
    } catch (error) {
      setChat(prev => [...prev, { role: 'bot', text: "Sorry, I had trouble processing that request." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestions = [
    "How do I vote for the first time?",
    "What documents do I need?",
    "How is the Prime Minister elected?"
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
          <p className="text-xs text-gray-500">Powered by Gemini 1.5 Pro</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
        <AnimatePresence initial={false}>
          {chat.map((c, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${c.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex max-w-[80%] ${c.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full ${
                  c.role === 'user' ? 'bg-gray-200 ml-2' : 'bg-primary-100 mr-2'
                }`}>
                  {c.role === 'user' ? <User size={16} className="text-gray-600" /> : <Bot size={16} className="text-primary-600" />}
                </div>
                <div className={`p-3 rounded-2xl ${
                  c.role === 'user' 
                    ? 'bg-primary-600 text-white rounded-tr-sm' 
                    : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed text-sm">{c.text}</p>
                </div>
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
               <div className="flex flex-row max-w-[80%]">
                 <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-primary-100 mr-2">
                    <Bot size={16} className="text-primary-600" />
                 </div>
                 <div className="p-3 bg-white border border-gray-200 rounded-2xl rounded-tl-sm shadow-sm flex space-x-1 items-center">
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
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-colors flex items-center"
              >
                <Sparkles size={12} className="mr-1 text-primary-500" /> {s}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Ask about the election process..."
            className="w-full bg-gray-100 text-gray-900 border-transparent focus:bg-white focus:ring-2 focus:ring-primary-500 rounded-xl py-3 pl-4 pr-12 transition-all outline-none"
            disabled={isLoading}
          />
          <button 
            type="submit" 
            disabled={!msg.trim() || isLoading}
            className="absolute right-2 p-2 text-primary-600 hover:bg-primary-50 rounded-lg disabled:opacity-50 transition-colors"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
