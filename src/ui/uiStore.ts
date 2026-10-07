import { create } from 'zustand';

export type Banner = { kind: 'error' | 'info'; text: string };

type UiState = {
  view: 'persp' | 'top';
  dragging: boolean;
  banner: Banner | null;
  setView(view: 'persp' | 'top'): void;
  setDragging(dragging: boolean): void;
  showBanner(banner: Banner): void;
  clearBanner(): void;
};

export const useUi = create<UiState>()((set) => ({
  view: 'persp',
  dragging: false,
  banner: null,
  setView: (view) => set({ view }),
  setDragging: (dragging) => set({ dragging }),
  showBanner: (banner) => set({ banner }),
  clearBanner: () => set({ banner: null }),
}));
