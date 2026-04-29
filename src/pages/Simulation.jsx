import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCcw, LogIn, IdCard, Stamp, CheckSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

const simulationSteps = [
  {
    id: 1,
    title: "Arrival at Polling Booth",
    desc: "You have arrived at the polling station. There is a line, and a polling officer is at the desk. What do you do first?",
    icon: LogIn,
    options: [
      { text: "Cut the line and go straight to the EVM.", isCorrect: false, feedback: "Incorrect. You must respect the queue and follow the process." },
      { text: "Join the queue and prepare your Voter ID or alternate ID.", isCorrect: true, feedback: "Correct! The First Polling Officer will check your name on the voter list and verify your ID." },
      { text: "Ask someone else to vote for you.", isCorrect: false, feedback: "Incorrect. Proxy voting is not allowed for regular citizens." }
    ]
  },
  {
    id: 2,
    title: "ID Verification",
    desc: "You reach the First Polling Officer. They ask for your identification.",
    icon: IdCard,
    options: [
      { text: "Show them a selfie from your phone.", isCorrect: false, feedback: "Incorrect. You need a valid ECI-approved photo ID." },
      { text: "Show your Voter ID (EPIC) or Aadhar/PAN.", isCorrect: true, feedback: "Correct! The officer will verify your identity against the electoral roll." }
    ]
  },
  {
    id: 3,
    title: "Inking and Signature",
    desc: "The Second Polling Officer checks your details.",
    icon: Stamp,
    options: [
      { text: "Sign the register and get your finger inked.", isCorrect: true, feedback: "Correct! Indelible ink is marked on your left forefinger, and you receive a voter slip." },
      { text: "Refuse the ink, you don't like stains.", isCorrect: false, feedback: "Incorrect. The ink mark is mandatory to prevent double voting." }
    ]
  },
  {
    id: 4,
    title: "Inside the Voting Compartment",
    desc: "You are alone with the Electronic Voting Machine (EVM) and VVPAT. How do you cast your vote?",
    icon: CheckSquare,
    options: [
      { text: "Press all the buttons.", isCorrect: false, feedback: "Incorrect. The EVM will only register one vote per person." },
      { text: "Press the blue button next to your chosen candidate's symbol.", isCorrect: true, feedback: "Correct! You will hear a beep sound, and the VVPAT will print a slip showing your vote for 7 seconds." },
      { text: "Take a picture of the EVM.", isCorrect: false, feedback: "Incorrect! Photography is strictly prohibited inside the voting compartment." }
    ]
  }
];

export default function Simulation() {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const handleOptionClick = (index) => {
    if (showFeedback) return;
    setSelectedOption(index);
    setShowFeedback(true);
  };

  const handleNext = () => {
    setShowFeedback(false);
    setSelectedOption(null);
    setCurrentStep(prev => prev + 1);
  };

  const resetSimulation = () => {
    setCurrentStep(0);
    setSelectedOption(null);
    setShowFeedback(false);
  };

  const step = simulationSteps[currentStep];
  const Icon = step?.icon;

  if (currentStep >= simulationSteps.length) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card bg-green-50 border-green-200 py-12">
          <div className="text-6xl mb-6">🎉</div>
          <h2 className="text-3xl font-bold text-green-800 mb-4">Simulation Complete!</h2>
          <p className="text-green-700 text-lg mb-8 max-w-md mx-auto">
            You successfully navigated the polling booth. You are now prepared to vote responsibly in the real world.
          </p>
          <div className="flex justify-center space-x-4">
            <button onClick={resetSimulation} className="btn-secondary flex items-center">
              <RefreshCcw size={18} className="mr-2" /> Play Again
            </button>
            <Link to="/" className="btn-primary">
              Return Home
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Polling Booth Simulation</h1>
        <div className="flex items-center mt-4 mb-2">
          <div className="text-sm font-medium text-primary-600 bg-primary-50 px-3 py-1 rounded-full">
            Step {currentStep + 1} of {simulationSteps.length}
          </div>
        </div>
        <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary-600 transition-all duration-500"
            style={{ width: `${((currentStep) / simulationSteps.length) * 100}%` }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="card shadow-md"
        >
          <div className="flex items-center mb-6 border-b border-gray-100 pb-4">
            <div className="bg-primary-100 p-3 rounded-xl text-primary-600 mr-4">
              <Icon size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{step.title}</h2>
            </div>
          </div>
          
          <p className="text-lg text-gray-700 mb-8">{step.desc}</p>

          <div className="space-y-4">
            {step.options.map((option, idx) => {
              let btnClass = "border-gray-200 text-gray-700 hover:border-primary-400 hover:bg-primary-50";
              
              if (showFeedback) {
                if (idx === selectedOption) {
                  btnClass = option.isCorrect 
                    ? "bg-green-50 border-green-500 text-green-800" 
                    : "bg-red-50 border-red-500 text-red-800";
                } else if (option.isCorrect) {
                  btnClass = "bg-green-50 border-green-500 text-green-800 opacity-50";
                } else {
                  btnClass = "opacity-50 border-gray-200";
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleOptionClick(idx)}
                  disabled={showFeedback}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-300 font-medium ${btnClass}`}
                  aria-pressed={idx === selectedOption}
                >
                  {option.text}
                </button>
              );
            })}
          </div>

          <AnimatePresence>
            {showFeedback && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-6 p-4 rounded-xl ${
                  step.options[selectedOption].isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}
                role="alert"
              >
                <p className="font-medium">{step.options[selectedOption].feedback}</p>
                {step.options[selectedOption].isCorrect && (
                  <button onClick={handleNext} className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors">
                    Continue to Next Step
                  </button>
                )}
                {!step.options[selectedOption].isCorrect && (
                  <button onClick={() => { setShowFeedback(false); setSelectedOption(null); }} className="mt-4 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors">
                    Try Again
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
