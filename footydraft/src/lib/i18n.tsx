import { createContext, useContext, useState, type ReactNode } from 'react';
import { translations } from './translations';

type Language = 'en' | 'tr';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: string) => {
    if (language === 'tr' && translations[key]) {
      return translations[key];
    }
    return key;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    return {
      t: (key: string) => key,
      language: 'en',
      setLanguage: () => {}
    };
  }
  return context;
}
