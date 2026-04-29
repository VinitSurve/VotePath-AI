import { Link, useLocation } from 'react-router-dom';
import { useExplain } from '../context/ExplainContext';
import { Baby, GraduationCap, Vote } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Navbar() {
  const { isELI5, setIsELI5 } = useExplain();
  const location = useLocation();
  
  const toggleELI5 = () => setIsELI5(!isELI5);

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2 text-primary-600 hover:text-primary-700 transition-colors">
            <Vote size={28} className="text-primary-600" />
            <span className="font-bold text-xl tracking-tight">VotePath <span className="text-gray-900">AI</span></span>
          </Link>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleELI5}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border transition-all duration-300 ${
                isELI5 
                  ? 'bg-yellow-100 border-yellow-300 text-yellow-800 shadow-sm' 
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
              }`}
              aria-label="Toggle Explain Like I'm 10 Mode"
            >
              {isELI5 ? (
                <>
                  <Baby size={18} />
                  <span className="text-sm font-bold tracking-wide">ELI5 Mode ON</span>
                </>
              ) : (
                <>
                  <GraduationCap size={18} />
                  <span className="text-sm font-medium">Standard Mode</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
