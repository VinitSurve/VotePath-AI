import { useExplain } from '../context/ExplainContext';
import { motion } from 'framer-motion';

const timeline = [
  { 
    title: "1. Notification", 
    standard: "The Election Commission of India (ECI) officially announces the election schedule via a press note, triggering the Model Code of Conduct.",
    eli5: "The bosses of the election announce that it's time to have an election!"
  },
  { 
    title: "2. Nomination", 
    standard: "Candidates submit their nomination papers and affidavits disclosing criminal records, assets, and liabilities to the Returning Officer.",
    eli5: "People who want to be leaders put their names on a list and promise to play fair."
  },
  { 
    title: "3. Scrutiny & Withdrawal", 
    standard: "Nomination papers are scrutinized for validity. Candidates have a window to withdraw their nominations if they choose not to contest.",
    eli5: "The bosses check the list to make sure everyone followed the rules. Some people can change their minds and leave."
  },
  { 
    title: "4. Campaigning", 
    standard: "Political parties and candidates campaign to win voter support. Campaigning must officially end 48 hours before polling begins.",
    eli5: "The candidates tell everyone their ideas and ask people to vote for them."
  },
  { 
    title: "5. Polling Day", 
    standard: "Voters cast their ballots using Electronic Voting Machines (EVMs) at designated polling stations under tight security.",
    eli5: "Everyone goes to vote! They press a button for the person they like."
  },
  { 
    title: "6. Counting & Results", 
    standard: "EVMs are opened on a scheduled day and votes are counted. The candidate with the maximum votes in a constituency is declared elected.",
    eli5: "They count all the votes to see who won the game!"
  }
];

export default function TimelinePage() {
  const { isELI5 } = useExplain();

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Election Timeline</h1>
        <p className="text-gray-600">
          {isELI5 ? "How an election happens from start to finish!" : "The chronological sequence of events in an Indian Election."}
        </p>
      </div>

      <div className="space-y-6">
        {timeline.map((event, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex flex-col sm:flex-row gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:border-primary-300 transition-colors"
          >
            <div className="sm:w-1/3">
              <h3 className="font-bold text-lg text-primary-700">{event.title}</h3>
            </div>
            <div className="sm:w-2/3 border-l-2 border-gray-100 pl-4">
              <p className="text-gray-600 leading-relaxed">
                {isELI5 ? event.eli5 : event.standard}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
