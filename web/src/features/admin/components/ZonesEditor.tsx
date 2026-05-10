import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  useCreateZone,
  useDeleteZone,
  useSetCmzZone,
  useUpdateZone,
  useZones,
} from '../hooks';
import { Button } from './Button';
import { inputCls } from './FormField';

interface Props {
  venueId: string;
  isFasal: boolean;
}

export const ZonesEditor = ({ venueId, isFasal }: Props) => {
  const { data: zones = [] } = useZones(venueId);
  const create = useCreateZone(venueId);
  const update = useUpdateZone(venueId);
  const remove = useDeleteZone(venueId);
  const setCmz = useSetCmzZone(venueId);
  const [name, setName] = useState('');

  const onAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await create.mutateAsync({ name: trimmed, is_cmz: false });
    setName('');
  };

  return (
    <div>
      <p className="mb-2 text-[12px] font-medium text-text">Zones</p>
      <div className="mb-2 flex gap-2">
        <input
          className={inputCls}
          placeholder="Zone name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onAdd();
            }
          }}
        />
        <Button size="sm" variant="secondary" onClick={onAdd}>
          <Plus size={12} /> Add
        </Button>
      </div>
      <ul className="space-y-1">
        {zones.length === 0 && (
          <li className="rounded border border-dashed border-border-default px-3 py-2 text-[12px] text-hint">
            No zones yet.
          </li>
        )}
        {zones.map((z) => (
          <li
            key={z.id}
            className="flex items-center gap-2 rounded border border-border-default bg-card px-3 py-1.5"
          >
            <input
              className={`${inputCls} flex-1`}
              defaultValue={z.name}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next && next !== z.name) {
                  update.mutate({ id: z.id, patch: { name: next } });
                }
              }}
            />
            <label
              className={`inline-flex items-center gap-1.5 text-[11px] ${
                isFasal ? 'text-text' : 'text-hint'
              }`}
            >
              <input
                type="checkbox"
                disabled={!isFasal}
                checked={z.is_cmz}
                onChange={(e) =>
                  setCmz.mutate({ zoneId: z.id, enable: e.target.checked })
                }
              />
              CMZ
            </label>
            <button
              type="button"
              onClick={() => remove.mutate(z.id)}
              className="rounded p-1.5 text-muted hover:bg-surface hover:text-danger"
              aria-label="Delete zone"
            >
              <Trash2 size={13} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
