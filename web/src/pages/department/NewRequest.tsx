import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/stores/toast';
import { Skeleton } from '@/components/Skeleton';
import {
  useDepartmentSigns,
  useSignTypes,
  useSizes,
  useSubmitNewSignAndOrder,
  useSubmitOrder,
} from '@/features/department/hooks';
import type { SignType } from '@/components/TypeBadge';

type Mode = 'pick' | 'create';

const pickSchema = z.object({
  signId: z.string().uuid('Pick a sign'),
  sizeId: z.string().uuid('Pick a size').optional().or(z.literal('')),
  quantity: z.coerce.number().int().min(1, 'At least 1'),
  notes: z.string().max(500).optional().or(z.literal('')),
});

const createSchema = z.object({
  canonicalName: z.string().trim().min(2, 'Name required'),
  descriptionLisan: z.string().max(500).optional().or(z.literal('')),
  signTypeId: z.string().uuid('Pick a sign type'),
  sizeId: z.string().uuid('Pick a size').optional().or(z.literal('')),
  quantity: z.coerce.number().int().min(1, 'At least 1'),
  notes: z.string().max(500).optional().or(z.literal('')),
});

type PickValues = z.infer<typeof pickSchema>;
type CreateValues = z.infer<typeof createSchema>;

const TYPE_LABEL: Record<SignType, string> = {
  prohibition: 'Prohibition',
  mandatory: 'Mandatory',
  warning: 'Warning',
  safe_condition: 'Safe Condition',
  direction: 'Direction',
  place: 'Place',
  notice: 'Notice',
};

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="rounded-lg border border-border-default bg-card p-5">
    <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">
      {title}
    </h2>
    <div className="grid gap-3">{children}</div>
  </section>
);

const Field = ({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) => (
  <label className="grid gap-1">
    <span className="text-[12px] font-medium text-text">{label}</span>
    {children}
    {error && <span className="text-[11px] text-danger">{error}</span>}
  </label>
);

const inputClasses =
  'h-9 w-full rounded-sm border border-border-default bg-card px-3 text-[13px] text-text outline-none transition focus:border-text';

export const NewRequestPage = () => {
  const session = useAuth((s) => s.session);
  const navigate = useNavigate();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>('pick');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const deptAssignment = useMemo(
    () =>
      session?.assignments.find(
        (a) =>
          a.role === 'department_user' &&
          a.event_id &&
          a.venue_id &&
          a.department_id,
      ) ?? null,
    [session],
  );

  const signs = useDepartmentSigns(deptAssignment?.department_id ?? undefined);
  const sizes = useSizes();
  const types = useSignTypes();

  const submitOrder = useSubmitOrder();
  const submitNew = useSubmitNewSignAndOrder();

  const pickForm = useForm<PickValues>({
    defaultValues: { signId: '', sizeId: '', quantity: 1, notes: '' },
  });
  const createForm = useForm<CreateValues>({
    defaultValues: {
      canonicalName: '',
      descriptionLisan: '',
      signTypeId: '',
      sizeId: '',
      quantity: 1,
      notes: '',
    },
  });

  if (!session) return null;

  if (!deptAssignment) {
    return (
      <div className="rounded-md border border-danger-border bg-danger-bg p-4 text-[13px] text-danger">
        No department assignment found for your account. Contact a Super Admin.
      </div>
    );
  }

  const eventId = deptAssignment.event_id as string;
  const venueId = deptAssignment.venue_id as string;
  const departmentId = deptAssignment.department_id as string;

  const onPick: SubmitHandler<PickValues> = (raw) => {
    setSubmitError(null);
    const parsed = pickSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path[0] as keyof PickValues;
        pickForm.setError(path, { message: issue.message });
      }
      return;
    }
    submitOrder.mutate(
      {
        eventId,
        venueId,
        departmentId,
        signId: parsed.data.signId,
        sizeId: parsed.data.sizeId || null,
        quantity: parsed.data.quantity,
        notes: parsed.data.notes || null,
        submittedBy: session.userId,
      },
      {
        onSuccess: () => {
          toast.success('Request submitted');
          navigate('/my/requests');
        },
        onError: (e) => {
          const msg = e instanceof ApiError ? e.message : 'Submit failed';
          setSubmitError(msg);
          toast.error(msg);
        },
      },
    );
  };

  const onCreate: SubmitHandler<CreateValues> = (raw) => {
    setSubmitError(null);
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path[0] as keyof CreateValues;
        createForm.setError(path, { message: issue.message });
      }
      return;
    }
    submitNew.mutate(
      {
        eventId,
        venueId,
        departmentId,
        signTypeId: parsed.data.signTypeId,
        canonicalName: parsed.data.canonicalName,
        descriptionLisan: parsed.data.descriptionLisan || null,
        sizeId: parsed.data.sizeId || null,
        quantity: parsed.data.quantity,
        notes: parsed.data.notes || null,
      },
      {
        onSuccess: () => {
          toast.success('New sign request submitted');
          navigate('/my/requests');
        },
        onError: (e) => {
          const msg = e instanceof ApiError ? e.message : 'Submit failed';
          setSubmitError(msg);
          toast.error(msg);
        },
      },
    );
  };

  const loadingDeps = signs.isLoading || sizes.isLoading || types.isLoading;
  const submitting = submitOrder.isPending || submitNew.isPending;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-text">New Request</h1>
        <p className="text-[13px] text-muted">
          Submit a sign request as Department HOD. Approval is required before production starts.
        </p>
      </div>

      <div className="mb-5 inline-flex rounded-sm border border-border-default bg-card p-0.5">
        <button
          type="button"
          onClick={() => setMode('pick')}
          className={`px-3 py-1.5 text-[12px] font-medium transition ${
            mode === 'pick' ? 'bg-text text-white' : 'text-muted hover:text-text'
          }`}
        >
          Pick existing sign
        </button>
        <button
          type="button"
          onClick={() => setMode('create')}
          className={`px-3 py-1.5 text-[12px] font-medium transition ${
            mode === 'create' ? 'bg-text text-white' : 'text-muted hover:text-text'
          }`}
        >
          Create new sign
        </button>
      </div>

      {submitError && (
        <div className="mb-4 rounded-md border border-danger-border bg-danger-bg p-3 text-[13px] text-danger">
          {submitError}
        </div>
      )}

      {loadingDeps && (
        <div className="space-y-2">
          <Skeleton className="h-32 w-full rounded" />
          <Skeleton className="h-32 w-full rounded" />
        </div>
      )}

      {!loadingDeps && mode === 'pick' && (
        <form onSubmit={pickForm.handleSubmit(onPick)} className="grid gap-4">
          <Section title="Sign">
            <Field label="Sign" error={pickForm.formState.errors.signId?.message}>
              <select className={inputClasses} {...pickForm.register('signId')}>
                <option value="">Select a sign…</option>
                {signs.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.canonical_name}
                    {s.sign_type ? ` — ${s.sign_type.name}` : ''}
                  </option>
                ))}
              </select>
            </Field>
          </Section>

          <Section title="Order">
            <Field label="Size" error={pickForm.formState.errors.sizeId?.message}>
              <select className={inputClasses} {...pickForm.register('sizeId')}>
                <option value="">No size</option>
                {sizes.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label ?? `${s.width} × ${s.height}`}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Quantity"
              error={pickForm.formState.errors.quantity?.message}
            >
              <input
                type="number"
                min={1}
                className={inputClasses}
                {...pickForm.register('quantity', { valueAsNumber: true })}
              />
            </Field>
            <Field label="Notes" error={pickForm.formState.errors.notes?.message}>
              <textarea
                rows={3}
                className={`${inputClasses} h-auto py-2`}
                {...pickForm.register('notes')}
              />
            </Field>
          </Section>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="h-9 rounded-sm bg-text px-4 text-[13px] font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      )}

      {!loadingDeps && mode === 'create' && (
        <form onSubmit={createForm.handleSubmit(onCreate)} className="grid gap-4">
          <Section title="New Sign">
            <Field
              label="Canonical name (English)"
              error={createForm.formState.errors.canonicalName?.message}
            >
              <input
                type="text"
                className={inputClasses}
                placeholder='e.g. "No Smoking"'
                {...createForm.register('canonicalName')}
              />
            </Field>
            <Field
              label="Description (Lisan ud-Da'wat / Arabic)"
              error={createForm.formState.errors.descriptionLisan?.message}
            >
              <textarea
                rows={2}
                dir="rtl"
                lang="ar"
                className={`${inputClasses} h-auto py-2 text-right`}
                {...createForm.register('descriptionLisan')}
              />
            </Field>
            <Field
              label="Sign type"
              error={createForm.formState.errors.signTypeId?.message}
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {types.data?.map((t) => (
                  <label
                    key={t.id}
                    className="flex cursor-pointer items-center gap-2 rounded-sm border border-border-default bg-card px-2.5 py-1.5 text-[12px] hover:bg-surface"
                  >
                    <input
                      type="radio"
                      value={t.id}
                      {...createForm.register('signTypeId')}
                    />
                    {TYPE_LABEL[t.name] ?? t.name}
                  </label>
                ))}
              </div>
            </Field>
          </Section>

          <Section title="Order">
            <Field
              label="Size"
              error={createForm.formState.errors.sizeId?.message}
            >
              <select
                className={inputClasses}
                {...createForm.register('sizeId')}
              >
                <option value="">No size</option>
                {sizes.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label ?? `${s.width} × ${s.height}`}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Quantity"
              error={createForm.formState.errors.quantity?.message}
            >
              <input
                type="number"
                min={1}
                className={inputClasses}
                {...createForm.register('quantity', { valueAsNumber: true })}
              />
            </Field>
            <Field
              label="Notes"
              error={createForm.formState.errors.notes?.message}
            >
              <textarea
                rows={3}
                className={`${inputClasses} h-auto py-2`}
                {...createForm.register('notes')}
              />
            </Field>
          </Section>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="h-9 rounded-sm bg-text px-4 text-[13px] font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Create Sign & Submit'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
