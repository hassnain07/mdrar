import { useState } from 'react';

async function translate(text: string, from: 'ar' | 'en', to: 'ar' | 'en'): Promise<string> {
  if (!text.trim()) return '';
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`,
    );
    const json = await res.json() as { responseData?: { translatedText?: string } };
    const translated = json.responseData?.translatedText ?? '';
    // MyMemory returns the original text unchanged when it can't translate
    return translated !== text ? translated : '';
  } catch {
    return '';
  }
}

/**
 * Manages a bilingual AR + EN field pair with automatic translation.
 * On blur of either field, if the counterpart hasn't been manually touched,
 * it is filled with a machine translation (MyMemory, free, no key needed).
 * Once the user manually edits a field, auto-translation stops for that field.
 */
export function useBilingualField(initialAr = '', initialEn = '') {
  const [ar, setArRaw] = useState(initialAr);
  const [en, setEnRaw] = useState(initialEn);
  const [arTouched, setArTouched] = useState(!!initialAr);
  const [enTouched, setEnTouched] = useState(!!initialEn);
  const [translating, setTranslating] = useState(false);

  const setAr = (value: string) => {
    setArRaw(value);
    setArTouched(true);
  };

  const setEn = (value: string) => {
    setEnRaw(value);
    setEnTouched(true);
  };

  // Call on onBlur of the Arabic input
  const onArBlur = async () => {
    if (!ar.trim() || enTouched) return;
    setTranslating(true);
    const result = await translate(ar, 'ar', 'en');
    if (result && !enTouched) setEnRaw(result);
    setTranslating(false);
  };

  // Call on onBlur of the English input
  const onEnBlur = async () => {
    if (!en.trim() || arTouched) return;
    setTranslating(true);
    const result = await translate(en, 'en', 'ar');
    if (result && !arTouched) setArRaw(result);
    setTranslating(false);
  };

  const reset = (newAr = '', newEn = '') => {
    setArRaw(newAr);
    setEnRaw(newEn);
    setArTouched(!!newAr);
    setEnTouched(!!newEn);
  };

  return { ar, en, setAr, setEn, onArBlur, onEnBlur, translating, reset };
}
