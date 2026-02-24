import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import he from './locales/he.json';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            he: { translation: he },
        },
        fallbackLng: 'en',
        interpolation: { escapeValue: false },
    });

export default i18n;
export const RTL_LANGUAGES = ['he', 'ar'];
export const isRTL = (lang: string) => RTL_LANGUAGES.includes(lang);
