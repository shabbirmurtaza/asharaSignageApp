/**
 * Reject-with-note modal. Note is required, min 5 chars (matches the
 * UX spec; RLS does not enforce this).
 */

import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { useToast } from '@/stores/toast';
import { useRejectUsage } from './hooks';

interface Props {
  usageId: string;
  signLabel: string;
  eventId: string;
  venueId: string;
  onClose: () => void;
}

export const RejectModal = ({ usageId, signLabel, eventId, venueId, onClose }: Props) => {
  const toast = useToast();
  const reject = useRejectUsage(eventId, venueId);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (note.trim().length < 5) {
      setError('Reason must be at least 5 characters.');
      return;
    }
    try {
      await reject.mutateAsync({ id: usageId, note: note.trim() });
      toast.success('Request rejected');
      onClose();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to reject';
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-lg bg-card p-5 shadow-xl">
        <h3 className="text-[15px] font-semibold text-text">Reject request</h3>
        <p className="mt-1 text-[13px] text-muted">{signLabel}</p>
        <label className="mt-3 flex flex-col gap-1 text-[12px] text-muted">
          Reason (visible to requester)
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-[90px] w-full rounded-sm border border-border-strong bg-card p-2 text-[13px] text-text"
          />
        </label>
        {error && (
          <p className="mt-2 rounded-md border border-danger-border bg-danger-bg p-2 text-[12px] text-danger">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-sm border border-border-strong px-3 text-[13px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={reject.isPending}
            className="h-8 rounded-sm bg-danger px-3 text-[13px] font-medium text-white disabled:opacity-60"
          >
            {reject.isPending ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </form>
    </div>
  );
};
