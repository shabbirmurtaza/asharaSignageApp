import { useState } from 'react';
import type { EventRow } from '../api';
import { FormField, inputCls } from './FormField';

export interface EventFormState {
  name: string;
  year: string;
  hijri_year: string;
  city: string;
  gregorian_year: string;
  notes: string;
  brand_primary: string;
  direction_colour: string;
  place_colour: string;
  notice_colour: string;
  is_archived: boolean;
}

const DEFAULT: EventFormState = {
  name: '',
  year: '',
  hijri_year: '',
  city: '',
  gregorian_year: '',
  notes: '',
  brand_primary: '#1f2937',
  direction_colour: '#0ea5e9',
  place_colour: '#22c55e',
  notice_colour: '#f59e0b',
  is_archived: false,
};

export const fromEventRow = (e: EventRow): EventFormState => ({
  name: e.name,
  year: e.year,
  hijri_year: e.hijri_year ?? '',
  city: e.city ?? '',
  gregorian_year: e.gregorian_year != null ? String(e.gregorian_year) : '',
  notes: e.notes ?? '',
  brand_primary: e.brand_primary ?? '#1f2937',
  direction_colour: e.direction_colour ?? '#0ea5e9',
  place_colour: e.place_colour ?? '#22c55e',
  notice_colour: e.notice_colour ?? '#f59e0b',
  is_archived: e.is_archived,
});

export const toEventPatch = (s: EventFormState): Partial<EventRow> => ({
  name: s.name.trim(),
  year: s.year.trim(),
  hijri_year: s.hijri_year || null,
  city: s.city || null,
  gregorian_year: s.gregorian_year ? Number(s.gregorian_year) : null,
  notes: s.notes || null,
  brand_primary: s.brand_primary || null,
  direction_colour: s.direction_colour || null,
  place_colour: s.place_colour || null,
  notice_colour: s.notice_colour || null,
  is_archived: s.is_archived,
});

export const useEventFormState = (initial?: EventRow) => {
  const [state, setState] = useState<EventFormState>(
    initial ? fromEventRow(initial) : DEFAULT,
  );
  return { state, setState };
};

export const EventDetailsTab = ({ state, setState }: {
  state: EventFormState;
  setState: (s: EventFormState) => void;
}) => {
  const set = <K extends keyof EventFormState>(k: K, v: EventFormState[K]) =>
    setState({ ...state, [k]: v });
  return (
    <div>
      <FormField label="Name">
        <input
          className={inputCls}
          value={state.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Year (Hijri label)">
          <input
            className={inputCls}
            value={state.year}
            onChange={(e) => set('year', e.target.value)}
            placeholder="1447"
          />
        </FormField>
        <FormField label="Gregorian year">
          <input
            type="number"
            className={inputCls}
            value={state.gregorian_year}
            onChange={(e) => set('gregorian_year', e.target.value)}
            placeholder="2025"
          />
        </FormField>
      </div>
      <FormField label="City">
        <input
          className={inputCls}
          value={state.city}
          onChange={(e) => set('city', e.target.value)}
        />
      </FormField>
      <FormField label="Notes">
        <textarea
          className={inputCls}
          rows={3}
          value={state.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </FormField>
      <label className="mt-1 inline-flex items-center gap-2 text-[12px] text-text">
        <input
          type="checkbox"
          checked={state.is_archived}
          onChange={(e) => set('is_archived', e.target.checked)}
        />
        Archived
      </label>
    </div>
  );
};

export const EventColoursTab = ({ state, setState }: {
  state: EventFormState;
  setState: (s: EventFormState) => void;
}) => {
  const set = <K extends keyof EventFormState>(k: K, v: EventFormState[K]) =>
    setState({ ...state, [k]: v });
  const ColorRow = ({
    label,
    field,
  }: {
    label: string;
    field: keyof EventFormState;
  }) => (
    <div className="mb-3 flex items-center justify-between gap-3">
      <span className="text-[12px] text-text">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          className="h-8 w-10 cursor-pointer rounded border border-border-default bg-card"
          value={state[field] as string}
          onChange={(e) => set(field, e.target.value as never)}
        />
        <input
          className={`${inputCls} w-28 font-mono text-[12px]`}
          value={state[field] as string}
          onChange={(e) => set(field, e.target.value as never)}
        />
      </div>
    </div>
  );
  return (
    <div>
      <p className="mb-3 text-[12px] text-muted">
        ISO 7010 sign types (prohibition, mandatory, etc.) are colour-locked.
        These overrides apply to direction / place / notice signs.
      </p>
      <ColorRow label="Brand primary" field="brand_primary" />
      <ColorRow label="Direction signs" field="direction_colour" />
      <ColorRow label="Place signs" field="place_colour" />
      <ColorRow label="Notice signs" field="notice_colour" />
    </div>
  );
};
