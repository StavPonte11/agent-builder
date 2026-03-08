import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import Backend from 'i18next-http-backend'

import enTranslation from './locales/en/translation.json'
import heTranslation from './locales/he/translation.json'

const resources = {
    en: { translation: enTranslation },
    he: { translation: heTranslation }
}

i18n
    .use(Backend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'en',
        supportedLngs: ['en', 'he'],
        interpolation: {
            escapeValue: false, // not needed for react as it escapes by default
        },
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
        }
    })

// Ensure right-to-left direction is applied to document body
i18n.on('languageChanged', (lng) => {
    document.documentElement.dir = i18n.dir(lng)
    document.documentElement.lang = lng
})

export default i18n
