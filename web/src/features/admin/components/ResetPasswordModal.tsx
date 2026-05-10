import { useState } from 'react';
import { useAdminResetPassword } from '../hooks';
import { useToast } from '@/stores/toast';
import { Button } from './Button';
import { Modal } from './Modal';
import { FormField, inputCls } from './FormField';

interface Props {
  open: boolean;
  userId: string;
  userName: string;
  onClose: () => void;
}

const generatePassword = (): string => {
  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 12; i++) out += chars[arr[i] % chars.length];
  return out;
};

export const ResetPasswordModal = ({
  open,
  userId,
  userName,
  onClose,
}: Props) => {
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const reset = useAdminResetPassword();
  const toast = useToast();

  const onSubmit = async () => {
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    try {
      await reset.mutateAsync({ userId, newPassword: password });
      setSubmitted(password);
      toast.success('Password reset.');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onCloseAll = () => {
    setPassword('');
    setSubmitted(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      title={`Reset password for ${userName}`}
      onClose={onCloseAll}
      footer={
        submitted ? (
          <div className="flex justify-end">
            <Button variant="primary" onClick={onCloseAll}>
              I&apos;ve saved it
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onCloseAll}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={onSubmit}
              disabled={reset.isPending}
            >
              Reset password
            </Button>
          </div>
        )
      }
    >
      {submitted ? (
        <div>
          <p className="mb-2 text-[12px] text-muted">
            Share this password with the user out-of-band. It will not be shown
            again.
          </p>
          <input
            readOnly
            className={`${inputCls} font-mono`}
            value={submitted}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      ) : (
        <>
          <FormField label="New password" hint="Minimum 6 characters.">
            <input
              type="text"
              className={`${inputCls} font-mono`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPassword(generatePassword())}
          >
            Generate random
          </Button>
        </>
      )}
    </Modal>
  );
};
