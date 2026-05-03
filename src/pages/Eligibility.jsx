import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Eligibility() {
  const [age, setAge] = useState('');
  const [isCitizen, setIsCitizen] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [ageError, setAgeError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const validateAge = (value) => {
    if (!value) {
      setAgeError('Age is required');
    } else if (isNaN(value) || parseInt(value) <= 0 || parseInt(value) > 130) {
      setAgeError('Please enter a valid age between 1 and 130');
    } else {
      setAgeError('');
    }
  };

  const checkEligibility = (e) => {
    e.preventDefault();
    setError('');
    setIsProcessing(true);

    if (!age || isNaN(age) || age <= 0 || age > 130) {
      setError("Please enter a valid age.");
      setResult(null);
      return;
    }

    if (isCitizen === null) {
      setError("Please select your citizenship status.");
      setResult(null);
      return;
    }

    const numAge = parseInt(age, 10);

    if (isCitizen && numAge >= 18) {
      setResult({
        status: 'eligible',
        title: "You are Eligible to Vote! 🎉",
        desc: "Great news! As an Indian citizen aged 18 or above, you have the right to vote.",
        nextSteps: ["Register for a Voter ID (Form 6)", "Find your polling booth", "Learn about candidates"]
      });
    } else if (!isCitizen) {
      setResult({
        status: 'ineligible',
        title: "Not Eligible ❌",
        desc: "Only Indian citizens are eligible to vote in Indian elections.",
        nextSteps: ["Non-Resident Indians (NRIs) can register as overseas electors (Form 6A) if holding an Indian passport."]
      });
    } else {
      setResult({
        status: 'ineligible',
        title: "Not Eligible Yet ⏳",
        desc: `You must be at least 18 years old to vote. You have ${18 - numAge} more years to go!`,
        nextSteps: ["Learn about the democratic process", "Stay informed about current events"]
      });
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Am I Eligible?</h1>
        <p className="text-gray-600">Quickly check if you can participate in the upcoming elections.</p>
      </div>

      <div className="card shadow-md">
        <form onSubmit={checkEligibility} className="space-y-6">
          {isProcessing && (
            <div className="p-6 border rounded-2xl bg-gray-50 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-5/6" />
            </div>
          )}
          <div>
            <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-2">
              What is your age? <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="age"
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
                onBlur={() => validateAge(age)}
                className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none ${
                  ageError ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}
              placeholder="e.g. 18"
              aria-required="true"
                aria-invalid={ageError ? "true" : "false"}
                aria-describedby={ageError ? "age-error" : undefined}
            />
              {ageError && (
                <p id="age-error" className="text-red-600 text-sm mt-1 flex items-center">
                  <AlertCircle size={14} className="mr-1" />
                  {ageError}
                </p>
              )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Are you a citizen of India? <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setIsCitizen(true)}
                className={`flex-1 py-3 border rounded-xl font-medium transition-all ${
                  isCitizen === true 
                    ? 'bg-primary-50 border-primary-500 text-primary-700 ring-1 ring-primary-500' 
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
                aria-pressed={isCitizen === true}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setIsCitizen(false)}
                className={`flex-1 py-3 border rounded-xl font-medium transition-all ${
                  isCitizen === false 
                    ? 'bg-primary-50 border-primary-500 text-primary-700 ring-1 ring-primary-500' 
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
                aria-pressed={isCitizen === false}
              >
                No
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center text-red-600 text-sm bg-red-50 p-3 rounded-lg" role="alert">
              <AlertCircle size={16} className="mr-2" />
              {error}
            </div>
          )}

          <button 
              type="submit"
              className="w-full btn-primary py-3 text-lg mt-4 transition-colors"
          >
            Check Eligibility
          </button>
        </form>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: 20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className={`mt-8 p-6 rounded-2xl border ${
              result.status === 'eligible' 
                ? 'bg-green-50 border-green-200' 
                : 'bg-orange-50 border-orange-200'
            }`}
            role="region"
            aria-live="polite"
          >
            <div className="flex items-start space-x-4">
              {result.status === 'eligible' ? (
                    <div className="flex items-center">
                      <CheckCircle2 className="text-green-600 mt-1" size={28} />
                      <div className="ml-3 text-3xl text-green-600 font-extrabold">✓</div>
                    </div>
              ) : (
                <XCircle className="text-orange-600 mt-1" size={28} />
              )}
              <div>
                <h3 className={`text-xl font-bold mb-2 ${
                  result.status === 'eligible' ? 'text-green-800' : 'text-orange-800'
                }`}>
                  {result.title}
                </h3>
                <p className={`mb-4 ${
                  result.status === 'eligible' ? 'text-green-700' : 'text-orange-700'
                }`}>
                  {result.desc}
                </p>
                
                <h4 className="font-bold text-gray-900 mb-2">Recommended Next Steps:</h4>
                <ul className="space-y-2 mb-6">
                  {result.nextSteps.map((step, i) => (
                    <li key={i} className="flex items-center text-sm text-gray-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-2" />
                      {step}
                    </li>
                  ))}
                </ul>

                {result.status === 'eligible' && (
                  <Link to="/journey" className="inline-block btn-primary bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg">
                    Start Your Journey
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
