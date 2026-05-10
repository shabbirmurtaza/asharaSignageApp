/**
 * Resolves the (event_id, venue_id) pair for the active signage_hod
 * assignment. Source of truth is the JWT-issued assignments array.
 *
 * Super admins have global scope (no event/venue) and must pick one via
 * <ScopeSwitcher /> before HOD screens render anything meaningful — for
 * super_admin we expose every distinct (event,venue) pair across the
 * usages table that they can act on; in practice the dashboard guards
 * against a null scope and asks the user to choose.
 */

import { useMemo } from 'react';
import { create } from 'zustand';
import { useAuth, type Assignment } from '@/lib/auth';

export interface HodScope {
  eventId: string;
  venueId: string;
}

interface SelectedHodScopeStore {
  selected: HodScope | null;
  setSelected: (next: HodScope | null) => void;
}

const STORAGE_KEY = 'hod.selectedScope';

const read = (): HodScope | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HodScope>;
    if (parsed.eventId && parsed.venueId) {
      return { eventId: parsed.eventId, venueId: parsed.venueId };
    }
    return null;
  } catch {
    return null;
  }
};

export const useSelectedHodScope = create<SelectedHodScopeStore>((set) => ({
  selected: read(),
  setSelected(next) {
    try {
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    set({ selected: next });
  },
}));

const isHodAssignment = (a: Assignment): boolean =>
  a.role === 'signage_hod' && !!a.event_id && !!a.venue_id;

/**
 * Returns:
 *   - scopes: every (event,venue) tuple the user has signage_hod on
 *   - active: the currently chosen scope (auto-selects first if unset)
 *   - setActive: switcher
 */
export const useHodScope = () => {
  const session = useAuth((s) => s.session);
  const selected = useSelectedHodScope((s) => s.selected);
  const setSelected = useSelectedHodScope((s) => s.setSelected);

  const scopes = useMemo<HodScope[]>(() => {
    if (!session) return [];
    const seen = new Set<string>();
    const out: HodScope[] = [];
    for (const a of session.assignments) {
      if (!isHodAssignment(a)) continue;
      const key = `${a.event_id}:${a.venue_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ eventId: a.event_id as string, venueId: a.venue_id as string });
    }
    return out;
  }, [session]);

  const active = useMemo<HodScope | null>(() => {
    if (selected) {
      const match = scopes.find(
        (s) => s.eventId === selected.eventId && s.venueId === selected.venueId,
      );
      if (match) return match;
    }
    return scopes[0] ?? null;
  }, [scopes, selected]);

  return {
    scopes,
    active,
    setActive: setSelected,
    hasScope: scopes.length > 0,
  };
};
