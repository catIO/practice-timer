import React, { createContext, useContext, useState } from 'react';

interface SharedReportContextType {
  creatorName: string | null;
  setCreatorName: (name: string | null) => void;
}

const SharedReportContext = createContext<SharedReportContextType | undefined>(undefined);

export function SharedReportProvider({ children }: { children: React.ReactNode }) {
  const [creatorName, setCreatorName] = useState<string | null>(null);

  return (
    <SharedReportContext.Provider value={{ creatorName, setCreatorName }}>
      {children}
    </SharedReportContext.Provider>
  );
}

export function useSharedReport() {
  const context = useContext(SharedReportContext);
  if (context === undefined) {
    throw new Error('useSharedReport must be used within a SharedReportProvider');
  }
  return context;
}
