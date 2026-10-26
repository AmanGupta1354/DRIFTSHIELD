import { create } from 'zustand';
import { readLocal, writeLocal } from '../lib/storage';
import type { Severity } from '../types';

export interface Toast {
  id: string;
  title: string;
  body?: string;
  tone: 'ok' | 'warn' | 'danger' | 'neon';
  severity?: Severity;
}

interface UiState {
  toasts: Toast[];
  sidebarCollapsed: boolean;
  mobileNav: boolean;
  searchFocusTick: number;
  push: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
  toggleSidebar: () => void;
  setMobileNav: (v: boolean) => void;
  focusSearch: () => void;
}

let n = 0;
export const useUi = create<UiState>((set, get) => ({
  toasts: [],
  sidebarCollapsed: readLocal('driftshield:sidebar', false),
  mobileNav: false,
  searchFocusTick: 0,
  push: (t) => {
    const id = `t${++n}`;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    setTimeout(() => get().dismiss(id), 5200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  toggleSidebar: () => {
    const v = !get().sidebarCollapsed;
    writeLocal('driftshield:sidebar', v);
    set({ sidebarCollapsed: v });
  },
  setMobileNav: (v) => set({ mobileNav: v }),
  focusSearch: () => set((s) => ({ searchFocusTick: s.searchFocusTick + 1 })),
}));
