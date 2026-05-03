import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, User, Sparkles, ShieldCheck, Send, Volume2, VolumeX } from "lucide-react";

function ChatBubble({ item, index, onSpeak, speakingIndex, copiedIndex, onCopy }) {
  const textToSpeak = item.role === "bot" ? `${item.data.title || ""}. ${item.data.simple || ""}` : "";

  return (
    <motion.div
      key={index}
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`flex flex-col ${item.role === "user" ? "items-end" : "items-start"}`}
    >
      <div className={`flex max-w-[85%] ${item.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
        <div className={`flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full shadow-sm ${item.role === "user" ? "bg-gray-100 ml-3" : "bg-primary-100 mr-3 mt-1"}`}>
          {item.role === "user" ? <User size={16} className="text-gray-600" /> : <Bot size={16} className="text-primary-600" />}
        </div>

        <div className={`p-5 rounded-2xl relative group ${item.role === "user" ? "bg-primary-600 text-white rounded-tr-sm shadow-md" : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-md"}`}>
          {item.role === "bot" && textToSpeak && (
            <button
              type="button"
              onClick={() => onSpeak(textToSpeak, index)}
              className={`absolute -right-10 top-2 p-2 rounded-full transition-all ${speakingIndex === index ? "bg-accent-100 text-accent-600 animate-pulse" : "bg-gray-50 text-gray-400 hover:text-primary-600 opacity-0 group-hover:opacity-100"}`}
              title="Read Aloud"
              aria-label={speakingIndex === index ? "Stop reading" : "Read aloud"}
            >
              {speakingIndex === index ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
            </button>
          )}

          {item.role === "user" ? (
            <p className="whitespace-pre-wrap leading-relaxed text-[15px]">{item.text}</p>
          ) : (
            <div className="space-y-4">
              {item.data.title && <p className="font-extrabold text-xl text-gray-900 tracking-tight">{item.data.title}</p>}

              {item.data.steps && item.data.steps.length > 0 && (
                <div className="space-y-2 mt-2">
                  {item.data.steps.map((step, stepIndex) => (
                    <div key={stepIndex} className="flex items-start bg-gray-50/80 p-3.5 rounded-xl border border-gray-100 hover:border-primary-100 hover:bg-primary-50/50 transition-colors">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs mr-3 mt-0.5">
                        {stepIndex + 1}
                      </div>
                      <div>
                        {step.title && <strong className="block text-gray-900 font-bold mb-0.5">{step.title}</strong>}
                        <span className="text-gray-600 text-[15px] leading-relaxed">{step.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {item.data.tips && item.data.tips.length > 0 && (
                <div className="mt-4 bg-yellow-50/80 border border-yellow-100 p-4 rounded-xl">
                  <strong className="flex items-center text-yellow-800 text-sm font-bold mb-2 uppercase tracking-wide">
                    <Sparkles size={14} className="mr-1.5" /> Important Tips
                  </strong>
                  <ul className="text-sm text-yellow-700 space-y-1.5 font-medium ml-1">
                    {item.data.tips.map((tip, tipIndex) => (
                      <li key={tipIndex} className="flex items-start"><span className="mr-2 text-yellow-500">•</span> {tip}</li>
                    ))}
                  </ul>
                </div>
              )}

              {item.data.simple && (
                <div className="mt-4 bg-accent-50/50 border-l-4 border-accent-500 pl-4 py-2 rounded-r-lg">
                  <p className="italic text-gray-700 text-[15px] font-medium leading-relaxed">{item.data.simple}</p>
                </div>
              )}
            </div>
          )}

          {item.role === "bot" && (
            <div className="text-xs text-blue-500 mt-3 flex items-center" aria-hidden="true">
              <span className="mr-1">✔</span>
              <span>Verified guidance based on official election procedures</span>
            </div>
          )}
        </div>
      </div>

      {item.role === "bot" && item.data.source && (
        <div className="flex items-center text-[11px] font-bold text-gray-400 mt-2 ml-14 bg-white/80 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-sm border border-gray-100">
          <ShieldCheck size={12} className="text-green-500 mr-1.5" />
          Source: {typeof item.data.source === "string" && item.data.source.toLowerCase().includes("http") ? (
            <a href={item.data.source} target="_blank" rel="noreferrer" className="text-green-600 underline">{item.data.source}</a>
          ) : item.data.source === "Election Commission of India" ? (
            <a href="https://eci.gov.in" target="_blank" rel="noreferrer" className="text-green-600 underline">Election Commission of India</a>
          ) : (
            <span>{item.data.source}</span>
          )}

          {item.data._meta?.responseTime && <span className="text-xs text-gray-400 ml-3">⏱ {item.data._meta.responseTime}s</span>}
          {item.data.lastUpdated && <span className="text-xs text-gray-400 ml-3">Updated as per latest public election guidelines</span>}
          {item.data.requestId && <span className="text-[10px] text-gray-400 ml-3">ID: {item.data.requestId}</span>}
        </div>
      )}

      {item.role === "bot" && (
        <div className="ml-14 mt-2 flex items-center space-x-2">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText((item.data.simple || item.data.title || "").toString());
                onCopy(index);
              } catch {}
            }}
            className="text-xs bg-gray-100 px-2 py-1 rounded-md hover:bg-gray-200 transition-all"
            aria-label="Copy message"
          >
            Copy
          </button>
          {copiedIndex === index && <span className="text-xs text-green-600">Copied ✓</span>}
        </div>
      )}

      {item.role === "bot" && item.data.errorType === "RATE_LIMIT" && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-1 mt-2 rounded-md ml-14">Too many requests. Please wait a few seconds.</div>
      )}
    </motion.div>
  );
}

function ChatConversation({
  chat,
  isLoading,
  isStreaming,
  streamingText,
  error,
  retryCountdown,
  onRetry,
  isRetrying,
  onSpeak,
  speakingIndex,
  copiedIndex,
  onCopy,
  endOfMessagesRef
}) {
  return (
    <section aria-label="Chat conversation" role="log" aria-live="polite" aria-relevant="additions text" className="flex-1 overflow-y-auto p-4 space-y-6 bg-gradient-to-b from-transparent to-gray-50/30">
      <AnimatePresence initial={false}>
        {chat.map((item, index) => (
          <ChatBubble
            key={index}
            item={item}
            index={index}
            onSpeak={onSpeak}
            speakingIndex={speakingIndex}
            copiedIndex={copiedIndex}
            onCopy={onCopy}
          />
        ))}

        {(isLoading || isStreaming) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start" role="status" aria-live="polite">
            <div className="flex flex-row max-w-[80%] items-center">
              <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-primary-100 mr-3 shadow-sm">
                <Bot size={16} className="text-primary-600" />
              </div>
              <div className="p-4 rounded-2xl rounded-tl-sm shadow-md flex flex-col space-y-2 items-start">
                <div className="w-48 h-3 bg-gray-200 rounded-md animate-pulse" />
                <div className="w-32 h-3 bg-gray-200 rounded-md animate-pulse" />
                <div className="w-40 h-3 bg-gray-200 rounded-md animate-pulse" />
                {isStreaming && streamingText && <div className="text-xs text-gray-500 mt-2">{streamingText}</div>}
                {isStreaming && !streamingText && <div className="text-xs text-gray-500 mt-2">typing...</div>}
              </div>
            </div>
          </motion.div>
        )}

        {chat.length === 0 && !isLoading && !error && (
          <div className="w-full text-center text-gray-400 mt-10" role="status">Ask anything about voting in India 🇮🇳</div>
        )}

        {chat.length === 0 && error && (
          <div className="w-full text-center text-red-500 mt-10">Unable to load assistant. Please refresh.</div>
        )}

        {error && chat.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center gap-2 items-center" role="alert" aria-live="polite" aria-atomic="true">
            <div className="text-sm text-red-500 bg-red-50 border border-red-100 px-4 py-2 rounded-xl font-medium">
              ⚠️ {error}
              {retryCountdown > 0 && ` (${retryCountdown}s)`}
            </div>
            <button
              onClick={onRetry}
              disabled={retryCountdown > 0 || isLoading}
              className={`px-3 py-1 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-red-700 transition-colors ${retryCountdown > 0 || isRetrying ? "animate-pulse" : ""}`}
              aria-label={retryCountdown > 0 ? `Retry in ${retryCountdown} seconds` : "Retry request"}
            >
              {isRetrying ? "Retrying..." : retryCountdown > 0 ? (
                <span>
                  Retry (<span aria-live="polite">{retryCountdown}s</span>)
                </span>
              ) : "Retry"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <div ref={endOfMessagesRef} />
    </section>
  );
}

export default memo(ChatConversation);
