import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bot, Map, CheckCircle, Clock, Zap } from 'lucide-react';

export default function Home() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-[80vh] space-y-12"
    >
      <div className="text-center space-y-6 max-w-2xl">
        <div className="inline-block px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full text-sm font-bold tracking-wide mb-2 shadow-sm border border-yellow-200">
          Millions of Indians vote without fully understanding the process. Let's fix that — in 60 seconds.
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-gray-900 leading-tight">
          Demystifying the <span className="text-primary-600">Election Process</span>
        </h1>
        <p className="text-xl text-gray-600">
          Your interactive guide to understanding how India votes. Fast, simple, and AI-powered.
        </p>
      </div>

      <motion.div 
        whileHover={{ scale: 1.02 }}
        className="w-full max-w-2xl bg-white p-2 rounded-2xl shadow-lg border border-gray-200 flex items-center focus-within:ring-4 focus-within:ring-primary-500/20 focus-within:border-primary-500 transition-all"
      >
        <Bot className="ml-4 text-gray-400" />
        <Link to="/chat" className="flex-1">
          <input 
            type="text" 
            placeholder="Ask anything about voting in India..." 
            className="w-full p-4 bg-transparent outline-none text-lg cursor-pointer"
            readOnly
          />
        </Link>
        <Link to="/chat" className="btn-primary rounded-xl px-6 py-3 shadow-md">
          Ask AI
        </Link>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-5xl">
        <FeatureCard 
          to="/learn-fast" 
          icon={<Zap className="text-yellow-500" size={24} />}
          title="Learn in 60s"
          desc="Quick crash course"
        />
        <FeatureCard 
          to="/eligibility" 
          icon={<CheckCircle className="text-green-500" size={24} />}
          title="Am I Eligible?"
          desc="Check your voting status"
        />
        <FeatureCard 
          to="/journey" 
          icon={<Map className="text-primary-500" size={24} />}
          title="The Journey"
          desc="Step-by-step process"
        />
        <FeatureCard 
          to="/timeline" 
          icon={<Clock className="text-purple-500" size={24} />}
          title="Timeline"
          desc="Key election dates"
        />
      </div>
    </motion.div>
  );
}

function FeatureCard({ to, icon, title, desc }) {
  return (
    <Link to={to} className="card hover:-translate-y-1 transition-transform duration-300 group cursor-pointer border-transparent hover:border-gray-200 shadow-sm hover:shadow-md">
      <div className="bg-gray-50 w-12 h-12 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="font-bold text-lg text-gray-900 mb-1">{title}</h3>
      <p className="text-gray-500 text-sm">{desc}</p>
    </Link>
  );
}
