import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import he from './locales/he.json'

export const i18n = i18next.createInstance()

void i18n.use(initReactI18next).init({
    resources: {
        en: { translation: en },
        he: { translation: he },
    },
    lng: localStorage.getItem('agent-builder-lang') ?? 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
})

/** Toggle between EN (LTR) and HE (RTL) */
export function toggleLanguage() {
    const next = i18n.language === 'en' ? 'he' : 'en'
    void i18n.changeLanguage(next)
    localStorage.setItem('agent-builder-lang', next)
    document.documentElement.lang = next
    document.documentElement.dir = next === 'he' ? 'rtl' : 'ltr'
}
