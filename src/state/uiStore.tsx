import { createContext, useContext, useReducer, useEffect, useCallback, type ReactNode } from 'react';
import type { Language, Suite } from '@/types';

interface UiState {
  language: Language;
  currentSuite: Suite;
  toast: string | null;
  sidebarOpen: boolean;
}

type UiAction =
  | { type: 'SET_LANGUAGE'; language: Language }
  | { type: 'SET_SUITE'; suite: Suite }
  | { type: 'SHOW_TOAST'; message: string }
  | { type: 'CLEAR_TOAST' }
  | { type: 'SET_SIDEBAR'; open: boolean };

const UI_STORAGE_KEY = 'mdrar_ui';

function loadUi(): UiState {
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UiState>;
      return { language: parsed.language ?? 'ar', currentSuite: parsed.currentSuite ?? 'hub', toast: null, sidebarOpen: false };
    }
  } catch { /* ignore */ }
  return { language: 'ar', currentSuite: 'hub', toast: null, sidebarOpen: false };
}

function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case 'SET_LANGUAGE': return { ...state, language: action.language };
    case 'SET_SUITE': return { ...state, currentSuite: action.suite };
    case 'SHOW_TOAST': return { ...state, toast: action.message };
    case 'CLEAR_TOAST': return { ...state, toast: null };
    case 'SET_SIDEBAR': return { ...state, sidebarOpen: action.open };
    default: return state;
  }
}

interface UiContextValue {
  ui: UiState;
  uiDispatch: React.Dispatch<UiAction>;
}

const UiContext = createContext<UiContextValue | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [ui, uiDispatch] = useReducer(uiReducer, undefined, loadUi);

  // Persist language + suite
  useEffect(() => {
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({ language: ui.language, currentSuite: ui.currentSuite }));
  }, [ui.language, ui.currentSuite]);

  // Sync html dir/lang
  useEffect(() => {
    document.documentElement.lang = ui.language;
    document.documentElement.dir = ui.language === 'ar' ? 'rtl' : 'ltr';
  }, [ui.language]);

  // Auto-clear toast
  useEffect(() => {
    if (ui.toast) {
      const t = setTimeout(() => uiDispatch({ type: 'CLEAR_TOAST' }), 3000);
      return () => clearTimeout(t);
    }
  }, [ui.toast]);

  return <UiContext.Provider value={{ ui, uiDispatch }}>{children}</UiContext.Provider>;
}

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi must be used within UiProvider');
  return ctx;
}

export function useToast() {
  const { uiDispatch } = useUi();
  return useCallback((message: string) => uiDispatch({ type: 'SHOW_TOAST', message }), [uiDispatch]);
}
