import { useExplain } from '../context/ExplainContext';
import { motion } from 'framer-motion';
import { Megaphone, FileSignature, SearchX, Users, Vote, Trophy } from 'lucide-react';

const timeline = [
  { 
    title: "Notification", 
    standard: "The Election Commission of India (ECI) officially announces the election schedule via a press note, triggering the Model Code of Conduct.",
    eli5: "The bosses of the election announce that it's time to have an election!",
    icon: Megaphone,
    color: "text-blue-500",
    bg: "bg-blue-100",
    border: "border-blue-500"
  },
  { 
    title: "Nomination", 
    standard: "Candidates submit their nomination papers and affidavits disclosing criminal records, assets, and liabilities to the Returning Officer.",
    eli5: "People who want to be leaders put their names on a list and promise to play fair.",
    icon: FileSignature,
    color: "text-purple-500",
    bg: "bg-purple-100",
    border: "border-purple-500"
  },
  { 
    title: "Scrutiny & Withdrawal", 
    standard: "Nomination papers are scrutinized for validity. Candidates have a window to withdraw their nominations if they choose not to contest.",
    eli5: "The bosses check the list to make sure everyone followed the rules. Some people can leave if they want.",
    icon: SearchX,
    color: "text-orange-500",
    bg: "bg-orange-100",
    border: "border-orange-500"
  },
  { 
    title: "Campaigning", 
    standard: "Political parties and candidates campaign to win voter support. Campaigning must officially end 48 hours before polling begins.",
    eli5: "The candidates tell everyone their ideas and ask people to vote for them.",
    icon: Users,
    color: "text-indigo-500",
    bg: "bg-indigo-100",
    border: "border-indigo-500"
  },
  { 
    title: "Polling Day", 
    standard: "Voters cast their ballots using Electronic Voting Machines (EVMs) at designated polling stations under tight security.",
    eli5: "Everyone goes to vote! They press a button for the person they like.",
    icon: Vote,
    color: "text-green-500",
    bg: "bg-green-100",
    border: "border-green-500"
  },
  { 
    title: "Counting & Results", 
    standard: "EVMs are opened on a scheduled day and votes are counted. The candidate with the maximum votes in a constituency is declared elected.",
    eli5: "They count all the votes to see who won the game!",
    icon: Trophy,
    color: "text-yellow-500",
    bg: "bg-yellow-100",
    border: "border-yellow-500"
  }
];

export default function TimelinePage() {
  const { isELI5 } = useExplain();

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-16"
      >
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">The Election Timeline</h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          {isELI5 ? "How an election happens from start to finish! 🚀" : "The chronological sequence of events in an Indian Election."}
        </p>
      </motion.div>

      <div className="relative wrap overflow-hidden p-4 md:p-10 h-full">
        <div className="absolute border-opacity-20 border-gray-400 h-full border-l-2 left-1/2 transform -translate-x-1/2 hidden md:block"></div>
        <div className="absolute border-opacity-20 border-gray-400 h-full border-l-2 left-[27px] block md:hidden"></div>
        
        {timeline.map((event, i) => {
          const isEven = i % 2 === 0;
          const Icon = event.icon;
          return (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`mb-12 flex justify-between items-center w-full ${isEven ? 'md:flex-row-reverse' : 'md:flex-row'}`}
            >
              <div className="order-1 w-0 md:w-5/12 hidden md:block"></div>
              <div className="z-20 flex items-center order-1 shadow-xl w-14 h-14 rounded-full ml-[-20px] md:ml-0 bg-white border-4 border-white shrink-0 relative group">
                 <div className={`absolute inset-0 rounded-full ${event.bg} opacity-50 group-hover:animate-ping`}></div>
                 <div className={`w-full h-full rounded-full flex items-center justify-center border-2 ${event.border} bg-white relative z-10`}>
                    <Icon size={24} className={event.color} />
                 </div>
              </div>
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className={`order-1 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all w-[calc(100%-4rem)] md:w-5/12 ml-4 md:ml-0 p-6 relative`}
              >
                {/* Arrow pointing to node */}
                <div className={`hidden md:block absolute top-6 w-0 h-0 border-y-8 border-y-transparent ${isEven ? 'left-[-8px] border-r-8 border-r-white drop-shadow-[-1px_0_1px_rgba(0,0,0,0.05)]' : 'right-[-8px] border-l-8 border-l-white drop-shadow-[1px_0_1px_rgba(0,0,0,0.05)]'}`}></div>
                <div className="md:hidden absolute top-6 left-[-8px] w-0 h-0 border-y-8 border-y-transparent border-r-8 border-r-white drop-shadow-[-1px_0_1px_rgba(0,0,0,0.05)]"></div>

                <div className="flex items-center mb-2 space-x-2">
                   <div className="font-bold text-gray-400 text-sm tracking-wider uppercase">Step {i + 1}</div>
                </div>
                <h3 className={`font-bold text-2xl mb-3 text-gray-900`}>{event.title}</h3>
                <p className="text-gray-600 leading-relaxed text-md">
                  {isELI5 ? event.eli5 : event.standard}
                </p>
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
