import React, { createContext, useContext, useState } from 'react';

const EvolutionContext = createContext(null);

export const EvolutionProvider = ({ children }) => {
  const [evolutionInstance, setEvolutionInstance] = useState(null);

  const value = {
    evolutionInstance,
    setEvolutionInstance
  };

  return (
    <EvolutionContext.Provider value={value}>
      {children}
    </EvolutionContext.Provider>
  );
};

export const useEvolution = () => {
  const context = useContext(EvolutionContext);
  if (!context) {
    throw new Error('useEvolution must be used within EvolutionProvider');
  }
  return context;
};
