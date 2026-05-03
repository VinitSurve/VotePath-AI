import React, { createContext, useContext, useState } from 'react';

const ExplainContext = createContext();

export function ExplainProvider({ children }) {
  const [isELI5, setIsELI5] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const toggleELI5 = () => {
    setIsSwitching(true);
    setIsELI5(prev => !prev);
    // short transition label
    setTimeout(() => setIsSwitching(false), 600);
  };

  return (
    <ExplainContext.Provider value={{ isELI5, setIsELI5, isSwitching, toggleELI5 }}>
      {children}
    </ExplainContext.Provider>
  );
}

export function useExplain() {
  const context = useContext(ExplainContext);
  if (context === undefined) {
    throw new Error('useExplain must be used within an ExplainProvider');
  }
  return context;
}
