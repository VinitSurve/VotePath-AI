import React, { createContext, useContext, useState } from 'react';

const ExplainContext = createContext();

export function ExplainProvider({ children }) {
  const [isELI5, setIsELI5] = useState(false);

  return (
    <ExplainContext.Provider value={{ isELI5, setIsELI5 }}>
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
