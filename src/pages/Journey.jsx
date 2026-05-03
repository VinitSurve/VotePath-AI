import { useState } from 'react';
import { useExplain } from '../context/ExplainContext';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Search, Building2, Vote, PartyPopper, ChevronDown } from 'lucide-react';

const steps = [
  {
    id: 1,
    icon: UserPlus,
    title: "Registration",
    standard: "Citizens turning 18 must register as voters by filling Form 6 (online via NVSP portal or offline). Upon verification, an EPIC (Voter ID) is issued.",
    eli5: "First, you tell the government you are old enough to vote by signing up. They give you a special ID card!",
    details: "To register, you need passport size photographs, identity proof, and address proof. You can track your application status online on the Election Commission website."
  },
  {
    id: 2,
    icon: Search,
    title: "Check Voter List",
    standard: "Before polling day, ensure your name appears in the Electoral Roll of your constituency. You can check this online using your EPIC number.",
    eli5: "Make sure your name is on the big list of voters for your area so they know you are coming.",
    details: "The electoral roll is constantly updated. Even if you voted in the last election, it is highly recommended to check your name again before the polling day."
  },
  {
    id: 3,
    icon: Building2,
    title: "Polling Day Arrival",
    standard: "Visit your designated polling station. Carry your EPIC or an ECI-approved alternate photo ID document along with your Voter Information Slip.",
    eli5: "On voting day, go to the special voting building and show them your ID card.",
    details: "Polling stations are usually set up in public buildings like schools. You are not allowed to carry mobile phones, cameras, or any political materials inside."
  },
  {
    id: 4,
    icon: Vote,
    title: "Cast Your Vote",
    standard: "A polling official will ink your finger. Proceed to the voting compartment, press the button against your candidate on the EVM, and verify via VVPAT.",
    eli5: "They put a tiny ink mark on your finger. Then, you go behind a screen and press a button for the person you want to win!",
    details: "If you don't want to vote for any candidate, you can press the NOTA (None Of The Above) button. The VVPAT slip is visible for 7 seconds before it drops into a sealed box."
  },
  {
    id: 5,
    icon: PartyPopper,
    title: "Results Day",
    standard: "Votes are counted under heavy security on a designated counting day. The candidate with the highest number of votes in the constituency is declared the winner.",
    eli5: "Later, they count all the votes. The person who gets the most votes is the winner!",
    details: "Counting is done in the presence of candidates or their authorized agents to ensure transparency. Trends and results are published live on the ECI website."
  }
];

export default function Journey() {
  const { isELI5, isSwitching } = useExplain();
  const [expandedId, setExpandedId] = useState(1);

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">The Voter's Journey</h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          {isELI5 
            ? "Here are the 5 easy steps to cast your vote! 🗳️" 
            : "An interactive step-by-step guide to participating in the democratic process."}
        </p>
      </motion.div>

      <div className="space-y-4">
        {isSwitching ? (
          // show skeleton cards while switching
          [1,2,3].map(i => (
            <div key={i} className="border border-gray-200 rounded-2xl overflow-hidden p-6 bg-gray-50 animate-pulse">
              <div className="h-6 bg-gray-200 w-1/3 rounded mb-4" />
              <div className="h-3 bg-gray-200 w-full rounded mb-2" />
              <div className="h-3 bg-gray-200 w-5/6 rounded" />
            </div>
          ))
        ) : 
          steps.map((step, index) => {
            const isExpanded = expandedId === step.id;
            return (
              <motion.div 
                key={step.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`border border-gray-200 rounded-2xl overflow-hidden transition-all duration-300 ${isExpanded ? 'bg-white shadow-md ring-1 ring-primary-500' : 'bg-gray-50 hover:bg-white hover:shadow-sm'}`}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : step.id)}
                  className="w-full flex items-center justify-between p-6 focus:outline-none"
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`flex items-center justify-center w-12 h-12 rounded-full transition-colors ${isExpanded ? 'bg-primary-600 text-white shadow-inner' : 'bg-primary-100 text-primary-600'}`}>
                      <step.icon size={24} />
                    </div>
                    <h3 className={`font-bold text-xl text-left transition-colors ${isExpanded ? 'text-primary-700' : 'text-gray-900'}`}>
                      {step.id}. {step.title}
                    </h3>
                  </div>
                  <ChevronDown 
                    size={24} 
                    className={`text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-primary-600' : ''}`} 
                  />
                </button>
                
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <div className="px-6 pb-6 pt-2 border-t border-gray-100 mt-2">
                        <p className="text-gray-800 text-lg leading-relaxed mb-4 font-medium">
                          {isELI5 ? step.eli5 : step.standard}
                        </p>
                        {!isELI5 && (
                          <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-blue-800 text-sm">
                            <span className="font-bold mr-1">Did you know?</span>
                            {step.details}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
      </div>
    </div>
  );
}
