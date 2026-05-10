import { useEffect, useState } from 'react';
import { useRejectSignup } from '../hooks';
import type { SignupRequestRow } from '../api';
import { useToast } from '@/stores/toast';
import { Button } from './Button';
import { Modal } from './Modal';
import { FormField, inputCls } from './FormField';

interface Props {
  open: boolean;
  request: SignupRequestRow | null;
  onClose: () => void;
}

export const RejectSignupModal = ({ open, request, onClose }: Props) => {
  const [note, setNote] = useState('');
  const reject = useRejectSignup();
  const toast = useToast();

  useEffect(() => {
    if (open) setNote('');
  }, [open]);

  if (!request) return null;

  const onSubmit = async () => {
    if (note.trim().length < 10) {
      toast.error('Please provide a reason of at least 10 characters.');
      return;
    }
    try {
      await reject.mutateAsync({ reqId: request.id, note: note.trim() });
      toast.success('Signup rejected.');
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Modal
      open={open}
      title={`Reject signup: ${request.name}`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={onSubmit}
            disabled={reject.isPending}
          >
            Reject
          </Button>
        </div>
      }
    >
      <FormField label="Rejection note" hint="Visible to user via notification.">
        <textarea
          autoFocus
          rows={4}
          className={inputCls}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </FormField>
    </Modal>
  );
};
