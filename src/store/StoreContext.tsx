import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { AppState, Action, FmUnit, FmDocument } from '@/types';
import { initialState } from '@/data/mockData';

const STORAGE_KEY = 'mdrar-state-v4';

function loadState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...initialState,
        ...parsed,
        projectActivities: { ...initialState.projectActivities, ...(parsed.projectActivities || {}) },
        projectDocuments: { ...initialState.projectDocuments, ...(parsed.projectDocuments || {}) },
        projectRisks: { ...initialState.projectRisks, ...(parsed.projectRisks || {}) },
        projectIpcEntries: { ...initialState.projectIpcEntries, ...(parsed.projectIpcEntries || {}) },
        fmUnits: parsed.fmUnits ?? initialState.fmUnits,
        fmDocuments: parsed.fmDocuments ?? initialState.fmDocuments,
        toast: null,
      };
    }
  } catch {
    // ignore
  }
  return initialState;
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_ROLE':
      return { ...state, currentRole: action.role };
    case 'SET_LANGUAGE':
      return { ...state, language: action.language };
    case 'CREATE_REQUEST':
      return { ...state, requests: [action.request, ...state.requests] };
    case 'UPDATE_REQUEST':
      return {
        ...state,
        requests: state.requests.map((r) =>
          r.id === action.id ? { ...r, ...action.changes, timeline: [...r.timeline, ...(action.changes.timeline || [])] } : r
        ),
      };
    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [action.notification, ...state.notifications] };
    case 'MARK_NOTIFICATIONS_READ':
      return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] };
    case 'ADD_USER':
      return { ...state, users: [...state.users, action.user] };
    case 'SET_PREFERENCE':
      return { ...state, preferences: { ...state.preferences, [action.key]: action.value } };
    case 'SHOW_TOAST':
      return { ...state, toast: action.message };
    case 'CLEAR_TOAST':
      return { ...state, toast: null };
    case 'SET_SUITE':
      return { ...state, currentSuite: action.suite };
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId ? { ...p, ...action.changes } : p
        ),
      };
    case 'ADD_PROJECT':
      return {
        ...state,
        projects: [...state.projects, action.project],
        projectActivities: { ...state.projectActivities, [action.project.id]: action.activities },
        projectDocuments: { ...state.projectDocuments, [action.project.id]: action.documents },
        projectRisks: { ...state.projectRisks, [action.project.id]: action.risks },
      };
    case 'UPDATE_ACTIVITY':
      return {
        ...state,
        projectActivities: {
          ...state.projectActivities,
          [action.projectId]: (state.projectActivities[action.projectId] || []).map((a) =>
            a.id === action.activityId ? { ...a, ...action.changes } : a
          ),
        },
      };
    case 'ADD_ACTIVITY':
      return {
        ...state,
        projectActivities: {
          ...state.projectActivities,
          [action.projectId]: [...(state.projectActivities[action.projectId] || []), action.activity],
        },
      };
    case 'DELETE_ACTIVITY':
      return {
        ...state,
        projectActivities: {
          ...state.projectActivities,
          [action.projectId]: (state.projectActivities[action.projectId] || []).filter((a) => a.id !== action.activityId),
        },
      };
    case 'ADD_UNIT':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId ? { ...p, unitTypes: [...p.unitTypes, action.unit] } : p
        ),
      };
    case 'UPDATE_UNIT':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId
            ? { ...p, unitTypes: p.unitTypes.map((u) => (u.id === action.unitId ? { ...u, ...action.changes } : u)) }
            : p
        ),
      };
    case 'DELETE_UNIT':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId ? { ...p, unitTypes: p.unitTypes.filter((u) => u.id !== action.unitId) } : p
        ),
      };
    case 'ADD_UNIT_INSTANCE':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId ? { ...p, unitInstances: [...(p.unitInstances || []), action.unit] } : p
        ),
      };
    case 'UPDATE_UNIT_INSTANCE':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId
            ? { ...p, unitInstances: (p.unitInstances || []).map((u) => u.id === action.unitId ? { ...u, ...action.changes } : u) }
            : p
        ),
      };
    case 'DELETE_UNIT_INSTANCE':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId ? { ...p, unitInstances: (p.unitInstances || []).filter((u) => u.id !== action.unitId) } : p
        ),
      };
    case 'ADD_DOCUMENT':
      return {
        ...state,
        projectDocuments: {
          ...state.projectDocuments,
          [action.projectId]: [...(state.projectDocuments[action.projectId] || []), action.document],
        },
      };
    case 'UPDATE_DOCUMENT':
      return {
        ...state,
        projectDocuments: {
          ...state.projectDocuments,
          [action.projectId]: (state.projectDocuments[action.projectId] || []).map((d) =>
            d.id === action.documentId ? { ...d, ...action.changes } : d
          ),
        },
      };
    case 'DELETE_DOCUMENT':
      return {
        ...state,
        projectDocuments: {
          ...state.projectDocuments,
          [action.projectId]: (state.projectDocuments[action.projectId] || []).filter((d) => d.id !== action.documentId),
        },
      };
    case 'ADD_RISK':
      return {
        ...state,
        projectRisks: {
          ...state.projectRisks,
          [action.projectId]: [...(state.projectRisks[action.projectId] || []), action.risk],
        },
      };
    case 'UPDATE_RISK':
      return {
        ...state,
        projectRisks: {
          ...state.projectRisks,
          [action.projectId]: (state.projectRisks[action.projectId] || []).map((r) =>
            r.id === action.riskId ? { ...r, ...action.changes } : r
          ),
        },
      };
    case 'DELETE_RISK':
      return {
        ...state,
        projectRisks: {
          ...state.projectRisks,
          [action.projectId]: (state.projectRisks[action.projectId] || []).filter((r) => r.id !== action.riskId),
        },
      };
    case 'ADD_IPC_ENTRY':
      return {
        ...state,
        projectIpcEntries: {
          ...state.projectIpcEntries,
          [action.projectId]: [...(state.projectIpcEntries[action.projectId] || []), action.entry],
        },
      };
    case 'UPDATE_IPC_ENTRY':
      return {
        ...state,
        projectIpcEntries: {
          ...state.projectIpcEntries,
          [action.projectId]: (state.projectIpcEntries[action.projectId] || []).map((e) =>
            e.id === action.entryId ? { ...e, ...action.changes } : e
          ),
        },
      };
    case 'DELETE_IPC_ENTRY':
      return {
        ...state,
        projectIpcEntries: {
          ...state.projectIpcEntries,
          [action.projectId]: (state.projectIpcEntries[action.projectId] || []).filter((e) => e.id !== action.entryId),
        },
      };
    case 'RENAME_DOCUMENT_CATEGORY':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId
            ? { ...p, documentCategoryNames: { ...(p.documentCategoryNames || {}), [action.category]: action.names } }
            : p
        ),
      };
    case 'ADD_FM_UNIT':
      return { ...state, fmUnits: [...state.fmUnits, action.unit] };
    case 'UPDATE_FM_UNIT':
      return { ...state, fmUnits: state.fmUnits.map((u) => u.id === action.unitId ? { ...u, ...action.changes } : u) };
    case 'ADD_FM_DOCUMENT':
      return { ...state, fmDocuments: [...state.fmDocuments, action.document] };
    case 'DELETE_FM_DOCUMENT':
      return { ...state, fmDocuments: state.fmDocuments.filter((d) => d.id !== action.documentId) };
    default:
      return state;
  }
}

interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    const { toast, ...persistable } = state;
    void toast;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
  }, [state]);

  useEffect(() => {
    document.documentElement.lang = state.language;
    document.documentElement.dir = state.language === 'ar' ? 'rtl' : 'ltr';
  }, [state.language]);

  useEffect(() => {
    if (state.toast) {
      const timer = setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 3000);
      return () => clearTimeout(timer);
    }
  }, [state.toast]);

  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

export { useToast } from '@/state/uiStore';

