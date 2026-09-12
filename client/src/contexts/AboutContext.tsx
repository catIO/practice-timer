import React, { createContext, useContext, useState, useCallback } from 'react';

export type AboutModalTab = 'about' | 'privacy' | 'data';

interface AboutContextType {
  isAboutModalOpen: boolean;
  activeTab: AboutModalTab;
  openAboutModal: (tab?: AboutModalTab) => void;
  closeAboutModal: () => void;
  setActiveTab: (tab: AboutModalTab) => void;
}

const AboutContext = createContext<AboutContextType | undefined>(undefined);

export function AboutProvider({ children }: { children: React.ReactNode }) {
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AboutModalTab>('about');

  const openAboutModal = useCallback((tab: AboutModalTab = 'about') => {
    setActiveTab(tab);
    setIsAboutModalOpen(true);
  }, []);

  const closeAboutModal = useCallback(() => {
    setIsAboutModalOpen(false);
  }, []);

  return (
    <AboutContext.Provider
      value={{
        isAboutModalOpen,
        activeTab,
        openAboutModal,
        closeAboutModal,
        setActiveTab,
      }}
    >
      {children}
    </AboutContext.Provider>
  );
}

export function useAboutModal() {
  const context = useContext(AboutContext);
  if (!context) {
    throw new Error('useAboutModal must be used within an AboutProvider');
  }
  return context;
}
