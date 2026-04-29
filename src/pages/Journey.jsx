import { useExplain } from '../context/ExplainContext';
import { motion } from 'framer-motion';
import { UserPlus, Search, Building2, Vote, PartyPopper } from 'lucide-react';

const steps = [
  {
    id: 1,
    icon: UserPlus,
    title: "Registration",
    standard: "Citizens turning 18 must register as voters by filling Form 6 (online via NVSP portal or offline). Upon verification, an EPIC (Voter ID) is issued.",
    eli5: "First, you tell the government you are old enough to vote by signing up. They give you a special ID card!"
  },
  {
    id: 2,
    icon: Search,
    title: "Check Voter List",
    standard: "Before polling day, ensure your name appears in the Electoral Roll of your constituency. You can check this online using your EPIC number.",
    eli5: "Make sure your name is on the big list of voters for your area so they know you are coming."
  },
  {
    id: 3,
    icon: Building2,
    title: "Polling Day Arrival",
    standard: "Visit your designated polling station. Carry your EPIC or an ECI-approved alternate photo ID document along with your Voter Information Slip.",
    eli5: "On voting day, go to the special voting building and show them your ID card."
  },
  {
    id: 4,
    icon: Vote,
    title: "Cast Your Vote",
    standard: "A polling official will ink your finger. Proceed to the voting compartment, press the button against your candidate on the EVM, and verify via VVPAT.",
    eli5: "They put a tiny ink mark on your finger. Then, you go behind a screen and press a button for the person you want to win!"
  },
  {
    id: 5,
    icon: PartyPopper,
    title: "Results Day",
    standard: "Votes are counted under heavy security on a designated counting day. The candidate with the highest number of votes in the constituency is declared the winner (First-past-the-post system).",
    eli5: "Later, they count all the votes. The person who gets the most votes is the winner!"
  }
];

export default function Journey() {
  const { isELI5 } = useExplain();

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Your Election Journey</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          {isELI5 
            ? "Here are the 5 easy steps to cast your vote!" 
            : "A comprehensive step-by-step guide to participating in the Indian democratic process."}
        </p>
      </div>

      <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-300 before:to-transparent">
        {steps.map((step, index) => (
          <motion.div 
            key={step.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
          >
            {/* Icon */}
            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-primary-100 text-primary-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 relative">
              <step.icon size={20} />
            </div>
            
            {/* Card */}
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-gray-900">{step.id}. {step.title}</h3>
                </div>
                <p className="text-gray-600 leading-relaxed text-sm">
                  {isELI5 ? step.eli5 : step.standard}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
