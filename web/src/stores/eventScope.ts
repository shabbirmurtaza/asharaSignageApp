/**
 * Selected-event scope. Only super_admin uses this; for everyone else, scope
 * is implicit in their role assignments.
 *
 * Stored as: 'all' (cross-event reporting) | <event uuid>
 */

import { create } from 'zustand';

const STORAGE_KEY = 'selectedEventId';
type Selected = string | 'all';

const read = (): Selected => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (!v) return 'all';
    return v === 'all' ? 'all' : v;
  } catch {
    return 'all';
  }
};

interface EventScopeStore {
  selected: Selected;
  setSelected: (next: Selected) => void;
}

export const useEventScope = create<EventScopeStore>((set) => ({
  selected: read(),
  setSelected(next) {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* noop */
    }
    set({ selected: next });
  },
}));

/** Effective event id for queries; null means "no filter" (All events). */
export const useScopedEventId = (): string | null => {
  const selected = useEventScope((s) => s.selected);
  return selected === 'all' ? null : selected;
};
