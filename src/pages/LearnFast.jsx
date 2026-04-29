import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, CheckCircle2, Flag, UserPlus, ClipboardCheck, IdCard, Vote } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const slides = [
  {
    title: "What is an Election?",
    content: "It's how we choose our leaders. You vote, and the person with the most votes wins and represents you in the government.",
    icon: Flag,
    color: "text-blue-500"
  },
  {
    title: "Who Can Vote?",
    content: "If you are an Indian citizen and 18 years or older, you have the right to vote! But first, you must register.",
    icon: UserPlus,
    color: "text-green-500"
  },
  {
    title: "How to Register?",
    content: "Fill out Form 6 online via the Voter Portal or Voter Helpline App. Once approved, you get a Voter ID card (EPIC).",
    icon: ClipboardCheck,
    color: "text-purple-500"
  },
  {
    title: "What to Carry?",
    content: "On election day, take your Voter ID (or another valid photo ID) and your Voter Slip to your designated polling booth.",
    icon: IdCard,
    color: "text-orange-500"
  },
  {
    title: "Inside the Booth",
    content: "Press the button next to your chosen candidate on the EVM. A beep confirms your vote, and the VVPAT shows a slip.",
    icon: Vote,
    color: "text-indigo-500"
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

  const Icon = slides[current].icon;

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh]">
      <div className="w-full max-w-lg">
        {/* Progress bar */}
        <div className="flex space-x-2 mb-8">
          {slides.map((_, i) => (
            <div key={i} className={`h-2 flex-1 rounded-full transition-colors duration-500 ${i <= current ? 'bg-primary-600' : 'bg-gray-200'}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -50, scale: 0.9 }}
            transition={{ duration: 0.3, type: "spring", bounce: 0.2 }}
            className="card min-h-[350px] flex flex-col items-center justify-center text-center space-y-6 shadow-xl border-2 border-primary-50 relative overflow-hidden"
          >
            {/* Background decorative blob */}
            <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-10 blur-2xl ${slides[current].color.replace('text', 'bg')}`}></div>
            
            <motion.div 
              initial={{ scale: 0 }} 
              animate={{ scale: 1, rotate: [0, 10, -10, 0] }} 
              transition={{ delay: 0.1, duration: 0.5 }}
              className={`p-6 rounded-full bg-gray-50 shadow-inner ${slides[current].color}`}
            >
              <Icon size={64} strokeWidth={1.5} />
            </motion.div>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">{slides[current].title}</h2>
            <p className="text-lg text-gray-600 leading-relaxed font-medium px-4">{slides[current].content}</p>
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between mt-8 px-2">
          <button 
            onClick={prev} 
            disabled={current === 0}
            className={`btn-secondary flex items-center shadow-sm ${current === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-x-1'}`}
          >
            <ChevronLeft size={20} /> Back
          </button>
          
          {current === slides.length - 1 ? (
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => nav('/journey')} 
              className="btn-primary flex items-center bg-green-600 hover:bg-green-700 shadow-md"
            >
              Start Journey <CheckCircle2 size={20} className="ml-2" />
            </motion.button>
          ) : (
            <button onClick={next} className="btn-primary flex items-center shadow-md hover:translate-x-1 transition-transform">
              Next <ChevronRight size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
