import { useEffect, useState } from 'react';
import { useCreateEvent, useUpdateEvent } from '../hooks';
import type { EventRow } from '../api';
import { useToast } from '@/stores/toast';
import { Button } from './Button';
import { Drawer } from './Drawer';
import {
  EventColoursTab,
  EventDetailsTab,
  fromEventRow,
  toEventPatch,
  type EventFormState,
} from './EventForm';
import { EventVenuesTab } from './EventVenuesTab';
import { EventZonesTab } from './EventZonesTab';

interface Props {
  open: boolean;
  event: EventRow | null;
  onClose: () => void;
}

type Tab = 'details' | 'venues' | 'zones' | 'colours';

const DEFAULT_STATE: EventFormState = {
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

export const EventDrawer = ({ open, event, onClose }: Props) => {
  const isEdit = !!event;
  const [tab, setTab] = useState<Tab>('details');
  const [state, setState] = useState<EventFormState>(DEFAULT_STATE);
  const create = useCreateEvent();
  const update = useUpdateEvent();
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setTab('details');
    setState(event ? fromEventRow(event) : DEFAULT_STATE);
  }, [open, event]);

  const onSave = async () => {
    if (!state.name.trim() || !state.year.trim()) {
      toast.error('Name and year are required.');
      return;
    }
    try {
      if (event) {
        await update.mutateAsync({ id: event.id, patch: toEventPatch(state) });
        toast.success('Event updated.');
      } else {
        await create.mutateAsync(toEventPatch(state));
        toast.success('Event created.');
        onClose();
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const tabs: { id: Tab; label: string; disabled?: boolean }[] = [
    { id: 'details', label: 'Details' },
    { id: 'venues', label: 'Venues', disabled: !isEdit },
    { id: 'zones', label: 'Zones', disabled: !isEdit },
    { id: 'colours', label: 'Brand colours' },
  ];

  return (
    <Drawer
      open={open}
      title={isEdit ? `Edit event: ${event!.name}` : 'Create event'}
      subtitle={isEdit ? `Year ${event!.year}` : 'Save details first to attach venues.'}
      onClose={onClose}
      width="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={onSave}
            disabled={create.isPending || update.isPending}
          >
            {isEdit ? 'Save changes' : 'Create event'}
          </Button>
        </div>
      }
    >
      <div className="mb-4 flex gap-1 border-b border-border-default">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={t.disabled}
            onClick={() => setTab(t.id)}
            className={`relative px-3 py-2 text-[12px] font-medium transition disabled:cursor-not-allowed disabled:text-hint ${
              tab === t.id
                ? 'text-text after:absolute after:inset-x-0 after:bottom-[-1px] after:h-[2px] after:bg-text'
                : 'text-muted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'details' && (
        <EventDetailsTab state={state} setState={setState} />
      )}
      {tab === 'venues' && event && <EventVenuesTab eventId={event.id} />}
      {tab === 'zones' && event && <EventZonesTab eventId={event.id} />}
      {tab === 'colours' && (
        <EventColoursTab state={state} setState={setState} />
      )}
    </Drawer>
  );
};
