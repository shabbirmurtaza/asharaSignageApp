import { useEffect, useState } from 'react';
import type { VenueRow, VenueType } from '../api';
import { useCreateVenue, useUpdateVenue } from '../hooks';
import { useToast } from '@/stores/toast';
import { Button } from './Button';
import { Drawer } from './Drawer';
import { FormField, inputCls } from './FormField';
import { ZonesEditor } from './ZonesEditor';

interface Props {
  open: boolean;
  venue: VenueRow | null;
  onClose: () => void;
}

interface FormState {
  name: string;
  type: VenueType;
  address: string;
  city: string;
  country: string;
  latitude: string;
  longitude: string;
  capacity: string;
}

const empty: FormState = {
  name: '',
  type: 'fasal_city',
  address: '',
  city: '',
  country: '',
  latitude: '',
  longitude: '',
  capacity: '',
};

const fromRow = (v: VenueRow): FormState => ({
  name: v.name,
  type: v.type,
  address: v.address ?? '',
  city: v.city ?? '',
  country: v.country ?? '',
  latitude: v.latitude != null ? String(v.latitude) : '',
  longitude: v.longitude != null ? String(v.longitude) : '',
  capacity: v.capacity != null ? String(v.capacity) : '',
});

const toPatch = (s: FormState): Partial<VenueRow> => ({
  name: s.name.trim(),
  type: s.type,
  address: s.address || null,
  city: s.city || null,
  country: s.country || null,
  latitude: s.latitude ? Number(s.latitude) : null,
  longitude: s.longitude ? Number(s.longitude) : null,
  capacity: s.capacity ? Number(s.capacity) : null,
});

export const VenueDrawer = ({ open, venue, onClose }: Props) => {
  const isEdit = !!venue;
  const [s, setS] = useState<FormState>(empty);
  const create = useCreateVenue();
  const update = useUpdateVenue();
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setS(venue ? fromRow(venue) : empty);
  }, [open, venue]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setS({ ...s, [k]: v });

  const onSave = async () => {
    if (!s.name.trim()) {
      toast.error('Name is required.');
      return;
    }
    try {
      if (venue) {
        await update.mutateAsync({ id: venue.id, patch: toPatch(s) });
        toast.success('Venue updated.');
      } else {
        await create.mutateAsync(toPatch(s));
        toast.success('Venue created.');
        onClose();
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Drawer
      open={open}
      title={isEdit ? `Edit venue: ${venue!.name}` : 'Create venue'}
      onClose={onClose}
      width="lg"
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
            {isEdit ? 'Save changes' : 'Create venue'}
          </Button>
        </div>
      }
    >
      <FormField label="Name">
        <input
          className={inputCls}
          value={s.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </FormField>
      <FormField label="Type">
        <div className="flex gap-3 text-[12px]">
          {(['fasal_city', 'relay_city'] as VenueType[]).map((t) => (
            <label key={t} className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                checked={s.type === t}
                onChange={() => set('type', t)}
              />
              {t}
            </label>
          ))}
        </div>
      </FormField>
      <FormField label="Address">
        <input
          className={inputCls}
          value={s.address}
          onChange={(e) => set('address', e.target.value)}
        />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="City">
          <input
            className={inputCls}
            value={s.city}
            onChange={(e) => set('city', e.target.value)}
          />
        </FormField>
        <FormField label="Country">
          <input
            className={inputCls}
            value={s.country}
            onChange={(e) => set('country', e.target.value)}
          />
        </FormField>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <FormField label="Latitude">
          <input
            type="number"
            step="any"
            className={inputCls}
            value={s.latitude}
            onChange={(e) => set('latitude', e.target.value)}
          />
        </FormField>
        <FormField label="Longitude">
          <input
            type="number"
            step="any"
            className={inputCls}
            value={s.longitude}
            onChange={(e) => set('longitude', e.target.value)}
          />
        </FormField>
        <FormField label="Capacity">
          <input
            type="number"
            className={inputCls}
            value={s.capacity}
            onChange={(e) => set('capacity', e.target.value)}
          />
        </FormField>
      </div>

      {isEdit && venue && (
        <div className="mt-4 border-t border-border-default pt-4">
          <ZonesEditor
            venueId={venue.id}
            isFasal={s.type === 'fasal_city'}
          />
        </div>
      )}
    </Drawer>
  );
};
