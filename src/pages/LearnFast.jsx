import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const slides = [
  {
    title: "What is an Election?",
    content: "It's how we choose our leaders. You vote, and the person with the most votes wins and represents you in the government.",
    icon: "🗳️"
  },
  {
    title: "Who Can Vote?",
    content: "If you are an Indian citizen and 18 years or older, you have the right to vote! But first, you must register.",
    icon: "👤"
  },
  {
    title: "How to Register?",
    content: "Fill out Form 6 online via the Voter Portal or Voter Helpline App. Once approved, you get a Voter ID card (EPIC).",
    icon: "📝"
  },
  {
    title: "What to Carry?",
    content: "On election day, take your Voter ID (or another valid photo ID) and your Voter Slip to your designated polling booth.",
    icon: "🪪"
  },
  {
    title: "Inside the Booth",
    content: "Press the button next to your chosen candidate on the EVM. A beep confirms your vote, and the VVPAT shows a slip.",
    icon: "✅"
  }
];

export default function LearnFast() {
  const [current, setCurrent] = useState(0);
  const nav = useNavigate();

  const next = () => {
    if (current < slides.length - 1) setCurrent(current + 1);
  };
  const prev = () => {
    if (current > 0) setCurrent(current - 1);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh]">
      <div className="w-full max-w-lg">
        {/* Progress bar */}
        <div className="flex space-x-2 mb-8">
          {slides.map((_, i) => (
            <div key={i} className={`h-2 flex-1 rounded-full transition-colors duration-300 ${i <= current ? 'bg-primary-600' : 'bg-gray-200'}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="card min-h-[300px] flex flex-col items-center justify-center text-center space-y-6 shadow-lg border-2 border-primary-50"
          >
            <div className="text-6xl">{slides[current].icon}</div>
            <h2 className="text-3xl font-bold text-gray-900">{slides[current].title}</h2>
            <p className="text-lg text-gray-600 leading-relaxed">{slides[current].content}</p>
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between mt-8">
          <button 
            onClick={prev} 
            disabled={current === 0}
            className={`btn-secondary flex items-center ${current === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <ChevronLeft size={20} /> Back
          </button>
          
          {current === slides.length - 1 ? (
            <button onClick={() => nav('/')} className="btn-primary flex items-center bg-green-600 hover:bg-green-700">
              I'm Ready <CheckCircle2 size={20} className="ml-2" />
            </button>
          ) : (
            <button onClick={next} className="btn-primary flex items-center">
              Next <ChevronRight size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
