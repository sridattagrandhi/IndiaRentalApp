// i18n.ts (root level, next to app/ folder)
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { translations } from './locales';

// Initialize i18n synchronously with default language
i18n
  .use(initReactI18next)
  .init({
    resources: translations,
    lng: 'en', // Start with English
    fallbackLng: 'en',
    compatibilityJSON: 'v4',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;