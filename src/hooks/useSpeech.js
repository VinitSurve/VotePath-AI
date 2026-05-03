import { useCallback, useState } from "react";
import { languageCodeMap } from "../utils/languageMap";

export function useSpeech(language) {
  const [speakingIndex, setSpeakingIndex] = useState(null);
  const [isListening, setIsListening] = useState(false);

  const speakText = useCallback((text, index) => {
    if (!("speechSynthesis" in window)) return;

    if (speakingIndex === index) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = languageCodeMap[language] || "en-IN";
    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);
    setSpeakingIndex(index);
    window.speechSynthesis.speak(utterance);
  }, [language, speakingIndex]);

  const startListening = useCallback((onTranscript) => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = languageCodeMap[language] || "en-IN";

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => onTranscript(event.results[0][0].transcript);
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  }, [language]);

  return {
    speakingIndex,
    isListening,
    speakText,
    startListening,
    setIsListening
  };
}
