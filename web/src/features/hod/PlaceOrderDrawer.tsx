/**
 * "Place order on behalf" — venue-locked, dept-pickable form.
 * Mirrors the department NewRequest "pick existing sign" path but
 * adds a department dropdown (HOD covers every dept at the venue).
 */

import { useEffect, useState } from 'react';
import { z } from 'zod';
import { ApiError } from '@/lib/api';
import { useToast } from '@/stores/toast';
import {
  useDepartments,
  usePlaceOrderOnBehalf,
  useSignSearch,
  useSizes,
  useZones,
} from './hooks';

const inputSchema = z.object({
  departmentId: z.string().uuid('Choose a department'),
  signId: z.string().uuid('Pick a sign'),
  zoneId: z.string().uuid().nullable().optional(),
  sizeId: z.string().uuid().nullable().optional(),
  qty: z.number().int().positive('Quantity must be ≥ 1'),
  notes: z.string().max(500).optional(),
});

interface Props {
  open: boolean;
  onClose: () => void;
  eventId: string;
  venueId: string;
}

export const PlaceOrderDrawer = ({ open, onClose, eventId, venueId }: Props) => {
  const toast = useToast();
  const depts = useDepartments();
  const zones = useZones(venueId);
  const sizes = useSizes();
  const [search, setSearch] = useState('');
  const signs = useSignSearch(search, open);
  const place = usePlaceOrderOnBehalf(eventId, venueId);

  const [departmentId, setDepartmentId] = useState('');
  const [signId, setSignId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [sizeId, setSizeId] = useState('');
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setDepartmentId(''); setSignId(''); setZoneId(''); setSizeId('');
      setQty(1); setNotes(''); setError(null); setSearch('');
    }
  }, [open]);

  if (!open) return null;

  const inputCls =
    'h-9 w-full rounded-sm border border-border-strong bg-card px-2.5 text-[13px] text-text';
  const selectCls = inputCls;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = inputSchema.safeParse({
      departmentId, signId,
      zoneId: zoneId || null,
      sizeId: sizeId || null,
      qty, notes: notes || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    try {
      await place.mutateAsync({
        eventId, venueId,
        departmentId: parsed.data.departmentId,
        signId: parsed.data.signId,
        zoneId: parsed.data.zoneId,
        sizeId: parsed.data.sizeId,
        qty: parsed.data.qty,
        notes: parsed.data.notes ?? null,
      });
      toast.success('Order placed on behalf — pending approval');
      onClose();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to place order';
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <form
        onSubmit={onSubmit}
        className="flex h-full w-[440px] flex-col gap-3 overflow-y-auto bg-card p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-text">Place order on behalf</h2>
          <button type="button" onClick={onClose} className="text-sm text-muted">Close</button>
        </div>

        <Field label="Department">
          <select className={selectCls} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">Select department…</option>
            {depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>

        <Field label="Find sign (catalogue)">
          <input className={inputCls} placeholder="Search by canonical name" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className={`${selectCls} mt-1`} value={signId} onChange={(e) => setSignId(e.target.value)} size={6}>
            {signs.data?.map((s) => <option key={s.id} value={s.id}>{s.canonical_name}</option>)}
          </select>
        </Field>

        <Field label="Zone (optional)">
          <select className={selectCls} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">— none —</option>
            {zones.data?.map((z) => <option key={z.id} value={z.id}>{z.name}{z.is_cmz ? ' (CMZ)' : ''}</option>)}
          </select>
        </Field>

        <Field label="Size (optional)">
          <select className={selectCls} value={sizeId} onChange={(e) => setSizeId(e.target.value)}>
            <option value="">— none —</option>
            {sizes.data?.map((s) => <option key={s.id} value={s.id}>{s.label ?? `${s.width}×${s.height}`}</option>)}
          </select>
        </Field>

        <Field label="Quantity">
          <input type="number" min={1} className={inputCls} value={qty} onChange={(e) => setQty(parseInt(e.target.value || '1', 10))} />
        </Field>

        <Field label="Notes (optional)">
          <textarea className={`${inputCls} min-h-[60px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {error && <p className="rounded-md border border-danger-border bg-danger-bg p-2 text-[12px] text-danger">{error}</p>}

        <button
          type="submit"
          disabled={place.isPending}
          className="mt-auto h-9 rounded-sm bg-text text-[13px] font-medium text-white disabled:opacity-60"
        >
          {place.isPending ? 'Placing…' : 'Place order'}
        </button>
      </form>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="flex flex-col gap-1 text-[12px] text-muted">
    {label}
    {children}
  </label>
);

// Tailwind doesn't ship a default form skin; bare utility classes for inputs.
// (Kept as runtime CSS by index.css's preflight; defining as constants would
// inflate LOC.) Re-using the same classes via a `className` prop avoids
// pulling in @tailwindcss/forms as a dep.
