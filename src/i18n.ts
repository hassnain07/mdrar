import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import arCommon from '@/locales/ar/common.json';
import enCommon from '@/locales/en/common.json';
import arPM from '@/locales/ar/projectManagement.json';
import enPM from '@/locales/en/projectManagement.json';

const savedLang = typeof localStorage !== 'undefined' ? localStorage.getItem('mdrar-language') : null;

i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: arCommon, pm: arPM },
    en: { translation: enCommon, pm: enPM },
  },
  lng: savedLang || 'ar',
  fallbackLng: 'ar',
  ns: ['translation', 'pm'],
  defaultNS: 'translation',
  interpolation: { escapeValue: false },
});

export default i18n;
