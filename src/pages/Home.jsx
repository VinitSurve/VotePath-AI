import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bot, Map, CheckCircle, Clock, Zap, Globe2, Ear } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] py-12 px-4 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-20 left-10 w-64 h-64 bg-primary-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
      <div className="absolute top-20 right-10 w-64 h-64 bg-accent-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-1/2 w-64 h-64 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000"></div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full max-w-6xl relative z-10 items-center mb-16">
        {/* Left Column: Typography & Action */}
        <motion.div 
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="space-y-8"
        >
          <div className="inline-block px-4 py-2 bg-white/70 backdrop-blur-md text-primary-800 rounded-full text-sm font-bold tracking-wide shadow-sm border border-white/50">
            Millions of Indians vote without fully understanding the process. Let's fix that.
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-gray-900 leading-[1.1]">
            Demystifying the <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-accent-500">Election Process</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-lg leading-relaxed">
            Your interactive guide to understanding how India votes. Fast, simple, and AI-powered.
          </p>
          
          <div className="flex flex-wrap gap-4 pt-4">
            <Link to="/learn-fast" className="btn-primary flex items-center px-8 py-4 text-lg">
              <Zap size={20} className="mr-2" /> Start in 60 Seconds
            </Link>
            <Link to="/chat" className="btn-secondary flex items-center px-8 py-4 text-lg">
              <Bot size={20} className="mr-2 text-primary-600" /> Ask VotePath AI
            </Link>
          </div>
        </motion.div>

        {/* Right Column: Floating Chips / Illustration */}
        <div className="relative h-[400px] w-full hidden md:block">
          <motion.div 
            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}
            className="absolute top-10 right-0 w-3/4 card hover:!scale-105 cursor-default flex items-center space-x-4 bg-white/80"
          >
            <div className="bg-yellow-100 p-3 rounded-full text-yellow-600"><Zap size={24} /></div>
            <div>
              <p className="font-bold text-gray-900">Learn in 60s</p>
              <p className="text-sm text-gray-500">Bite-sized visual lessons</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }}
            className="absolute top-1/2 -translate-y-1/2 left-0 w-3/4 card hover:!scale-105 cursor-default flex items-center space-x-4 bg-white/80"
          >
            <div className="bg-primary-100 p-3 rounded-full text-primary-600"><Globe2 size={24} /></div>
            <div>
              <p className="font-bold text-gray-900">Speak Your Language</p>
              <p className="text-sm text-gray-500">Hindi, Marathi, Tamil, English</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.6 }}
            className="absolute bottom-10 right-10 w-2/3 card hover:!scale-105 cursor-default flex items-center space-x-4 bg-white/80"
          >
            <div className="bg-accent-100 p-3 rounded-full text-accent-600"><Ear size={24} /></div>
            <div>
              <p className="font-bold text-gray-900">AI Talks Back</p>
              <p className="text-sm text-gray-500">Voice-guided assistance</p>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-6xl relative z-10">
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
    </div>
  );
}

function FeatureCard({ to, icon, title, desc }) {
  return (
    <Link to={to} className="card group cursor-pointer border border-white/40 shadow-lg hover:shadow-xl hover:border-primary-200">
      <div className="bg-white/80 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
        {icon}
      </div>
      <h3 className="font-bold text-lg text-gray-900 mb-1 group-hover:text-primary-600 transition-colors">{title}</h3>
      <p className="text-gray-500 text-sm font-medium">{desc}</p>
    </Link>
  );
}
