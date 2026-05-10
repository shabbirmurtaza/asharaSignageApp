import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { ApiError, db } from '@/lib/api';
import { useToast } from '@/stores/toast';

/* ============================================================
   Wizard schema (single source of truth, validated per-step).
   Mirrors signup_request() RPC arg constraints:
     - ITS = 8 digits
     - password >= 8 chars (RPC requires 6 but spec asks 8)
     - email RFC-ish (zod email)
   ============================================================ */
const personalSchema = z.object({
  name: z.string().trim().min(2, 'Name required'),
  email: z.string().trim().email('Valid email required'),
  itsNumber: z
    .string()
    .trim()
    .regex(/^\d{8}$/, 'ITS Number must be 8 digits'),
  contactNumber: z
    .string()
    .trim()
    .min(7, 'Contact number required'),
});

const credentialsSchema = z
  .object({
    password: z.string().min(8, 'Min 8 characters'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match',
  });

const departmentSchema = z.object({
  departmentId: z.string().uuid('Pick a department'),
});

const venueSchema = z.object({
  venueId: z.string().uuid('Pick a venue'),
});

interface FormState {
  name: string;
  email: string;
  itsNumber: string;
  contactNumber: string;
  password: string;
  confirm: string;
  departmentId: string;
  venueId: string;
}

const initialState: FormState = {
  name: '',
  email: '',
  itsNumber: '',
  contactNumber: '',
  password: '',
  confirm: '',
  departmentId: '',
  venueId: '',
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

interface DefaultEvent {
  id: string;
  name: string;
  year: string;
  city: string;
  brand_primary: string | null;
}

interface DepartmentRow {
  id: string;
  name: string;
  name_lisan: string | null;
}

interface VenueRow {
  id: string;
  name: string;
  type: 'fasal_city' | 'relay_city' | string;
  city: string | null;
}

/* ============================================================
   Step metadata
   ============================================================ */
const STEPS = [
  { key: 'personal', title: 'Personal', subtitle: 'Who are you?' },
  { key: 'credentials', title: 'Credentials', subtitle: 'Set a password' },
  { key: 'department', title: 'Department', subtitle: 'Where you work' },
  { key: 'venue', title: 'Venue', subtitle: 'Your assigned venue' },
  { key: 'review', title: 'Review', subtitle: 'Confirm and submit' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

/* ============================================================
   Strength hint — purely UX, no security implication
   ============================================================ */
const passwordStrength = (pw: string): { label: string; score: 0 | 1 | 2 | 3 } => {
  if (!pw) return { label: '', score: 0 };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  const label = ['Weak', 'Weak', 'Okay', 'Strong'][score] ?? 'Weak';
  return { label, score: score as 0 | 1 | 2 | 3 };
};

export const SignupPage = () => {
  const toast = useToast();
  const [step, setStep] = useState<StepKey>('personal');
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [event, setEvent] = useState<DefaultEvent | null>(null);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Bootstrap: get default event + departments in parallel.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [evRows, depts] = await Promise.all([
          db.rpc<DefaultEvent[]>('get_default_event'),
          db.rpc<DepartmentRow[]>('list_departments_for_signup'),
        ]);
        if (cancelled) return;
        const ev = Array.isArray(evRows) ? evRows[0] ?? null : null;
        setEvent(ev);
        setDepartments(depts);
      } catch (err) {
        if (!cancelled) {
          setServerError(
            err instanceof Error
              ? err.message
              : 'Failed to load signup data',
          );
        }
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // When event resolves, fetch its venues.
  useEffect(() => {
    if (!event) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await db.rpc<VenueRow[]>('list_venues_for_signup', {
          p_event_id: event.id,
        });
        if (!cancelled) setVenues(rows);
      } catch (err) {
        if (!cancelled) {
          setServerError(
            err instanceof Error ? err.message : 'Failed to load venues',
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [event]);

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const validateStep = (which: StepKey): boolean => {
    const next: FieldErrors = {};
    const apply = (result: { success: boolean; error?: z.ZodError }) => {
      if (!result.success && result.error) {
        for (const issue of result.error.issues) {
          const field = issue.path[0] as keyof FormState;
          if (!next[field]) next[field] = issue.message;
        }
      }
    };
    if (which === 'personal') {
      apply(
        personalSchema.safeParse({
          name: form.name,
          email: form.email,
          itsNumber: form.itsNumber,
          contactNumber: form.contactNumber,
        }),
      );
    } else if (which === 'credentials') {
      apply(
        credentialsSchema.safeParse({
          password: form.password,
          confirm: form.confirm,
        }),
      );
    } else if (which === 'department') {
      apply(departmentSchema.safeParse({ departmentId: form.departmentId }));
    } else if (which === 'venue') {
      apply(venueSchema.safeParse({ venueId: form.venueId }));
    }
    setErrors((prev) => ({ ...prev, ...next }));
    return Object.keys(next).length === 0;
  };

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  const goNext = () => {
    if (!validateStep(step)) return;
    const nextIdx = Math.min(stepIndex + 1, STEPS.length - 1);
    setStep(STEPS[nextIdx].key);
  };

  const goBack = () => {
    const prevIdx = Math.max(stepIndex - 1, 0);
    setStep(STEPS[prevIdx].key);
  };

  const submit = async () => {
    if (!event) {
      setServerError('No default event configured. Contact super admin.');
      return;
    }
    // Validate all steps before sending.
    const ok =
      validateStep('personal') &&
      validateStep('credentials') &&
      validateStep('department') &&
      validateStep('venue');
    if (!ok) return;

    setSubmitting(true);
    setServerError(null);
    try {
      await db.rpc<string>('signup_request', {
        p_its_number: form.itsNumber.trim(),
        p_name: form.name.trim(),
        p_email: form.email.trim(),
        p_contact_number: form.contactNumber.trim(),
        p_password: form.password,
        p_event_id: event.id,
        p_venue_id: form.venueId,
        p_department_id: form.departmentId,
      });
      setSubmitted(true);
      toast.success('Signup request submitted');
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Submission failed';
      setServerError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) return <SuccessScreen />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-xl rounded-lg border border-border-default bg-card px-8 py-9">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-hint">
          Ashara Mubaraka
        </p>
        <h1 className="mt-1.5 text-[26px] font-medium leading-tight tracking-[-0.01em] text-text">
          Request access
        </h1>
        {event && (
          <p className="mt-1.5 text-[13px] text-muted">
            For event <span className="font-medium text-text">{event.name}</span>
            {event.city ? <> · {event.city}</> : null}
          </p>
        )}

        <Stepper current={stepIndex} />

        {serverError && (
          <div
            role="alert"
            aria-live="polite"
            className="mt-5 rounded-sm border border-danger-border bg-danger-bg px-3 py-2 text-[12px] text-danger"
          >
            {serverError}
          </div>
        )}

        <div className="mt-6">
          {step === 'personal' && (
            <PersonalStep form={form} errors={errors} setField={setField} />
          )}
          {step === 'credentials' && (
            <CredentialsStep form={form} errors={errors} setField={setField} />
          )}
          {step === 'department' && (
            <DepartmentStep
              form={form}
              errors={errors}
              setField={setField}
              departments={departments}
              loading={loadingMeta}
            />
          )}
          {step === 'venue' && (
            <VenueStep
              form={form}
              errors={errors}
              setField={setField}
              venues={venues}
              loading={loadingMeta && venues.length === 0}
            />
          )}
          {step === 'review' && (
            <ReviewStep
              form={form}
              event={event}
              departments={departments}
              venues={venues}
            />
          )}
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-border-default pt-5">
          <button
            type="button"
            onClick={goBack}
            disabled={stepIndex === 0 || submitting}
            className="h-9 rounded-sm border border-border-strong bg-card px-4 text-[13px] text-text outline-none transition hover:bg-surface focus-visible:shadow-[0_0_0_3px_rgba(0,0,0,0.05)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back
          </button>
          {step !== 'review' ? (
            <button
              type="button"
              onClick={goNext}
              className="h-9 rounded-sm bg-text px-5 text-[13px] font-medium text-white outline-none transition hover:opacity-90 active:translate-y-[0.5px] focus-visible:shadow-[0_0_0_3px_rgba(31,31,29,0.18)]"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="h-9 rounded-sm bg-text px-5 text-[13px] font-medium text-white outline-none transition hover:opacity-90 active:translate-y-[0.5px] focus-visible:shadow-[0_0_0_3px_rgba(31,31,29,0.18)] disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit request'}
            </button>
          )}
        </div>

        <p className="mt-5 text-center text-[12px] text-muted">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-info underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

/* ============================================================
   Subcomponents — kept colocated; this is the only consumer.
   ============================================================ */

const Stepper = ({ current }: { current: number }) => {
  const total = STEPS.length;
  const active = STEPS[current];
  return (
    <div className="mt-7 border-y border-border-default py-3">
      <ol
        className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5"
        aria-label="Signup progress"
      >
        {STEPS.map((s, i) => {
          const isActive = i === current;
          const isDone = i < current;
          return (
            <li key={s.key} className="flex items-baseline gap-2 text-[12px]">
              <span
                aria-current={isActive ? 'step' : undefined}
                className={[
                  'tabular-nums tracking-[0.04em]',
                  isActive
                    ? 'text-text'
                    : isDone
                      ? 'text-muted'
                      : 'text-hint',
                ].join(' ')}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span
                className={[
                  isActive
                    ? 'font-medium text-text'
                    : isDone
                      ? 'text-muted'
                      : 'text-hint',
                ].join(' ')}
              >
                {s.title}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-1 text-[11px] text-hint">
        Step {current + 1} of {total} — {active.subtitle}
      </p>
    </div>
  );
};

interface StepProps {
  form: FormState;
  errors: FieldErrors;
  setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}

const Field = ({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: (a: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode;
}) => {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[12px] font-medium tracking-[0.01em] text-text"
      >
        {label}
      </label>
      {children({ id, describedBy, invalid: !!error })}
      {error ? (
        <span id={`${id}-error`} className="text-[11px] text-danger">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="text-[11px] text-hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
};

const inputCls =
  'h-10 rounded-sm border border-border-strong bg-card px-3 text-[13px] text-text placeholder:text-hint outline-none transition focus:border-text focus:shadow-[0_0_0_3px_rgba(0,0,0,0.05)] disabled:opacity-60';
const inputErrCls =
  'border-danger focus:border-danger focus:shadow-[0_0_0_3px_rgba(163,45,45,0.12)]';

const cn = (...xs: Array<string | false | undefined>) => xs.filter(Boolean).join(' ');

const PersonalStep = ({ form, errors, setField }: StepProps) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <Field id="su-name" label="Full name" error={errors.name}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          className={cn(inputCls, invalid && inputErrCls)}
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          autoComplete="name"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
      )}
    </Field>
    <Field id="su-email" label="Email" error={errors.email}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          className={cn(inputCls, invalid && inputErrCls)}
          type="email"
          value={form.email}
          onChange={(e) => setField('email', e.target.value)}
          autoComplete="email"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
      )}
    </Field>
    <Field
      id="su-its"
      label="ITS Number"
      hint={errors.itsNumber ? undefined : '8 digits'}
      error={errors.itsNumber}
    >
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          className={cn(inputCls, 'tabular-nums', invalid && inputErrCls)}
          inputMode="numeric"
          maxLength={8}
          value={form.itsNumber}
          onChange={(e) =>
            setField('itsNumber', e.target.value.replace(/\D/g, '').slice(0, 8))
          }
          autoComplete="username"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
      )}
    </Field>
    <Field id="su-contact" label="Contact number" error={errors.contactNumber}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          className={cn(inputCls, invalid && inputErrCls)}
          type="tel"
          value={form.contactNumber}
          onChange={(e) => setField('contactNumber', e.target.value)}
          autoComplete="tel"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
      )}
    </Field>
  </div>
);

const CredentialsStep = ({ form, errors, setField }: StepProps) => {
  const strength = useMemo(() => passwordStrength(form.password), [form.password]);
  const barColor = ['bg-border-default', 'bg-danger', 'bg-warn', 'bg-success'][
    strength.score
  ];
  return (
    <div className="flex flex-col gap-4">
      <Field id="su-pw" label="Password" error={errors.password}>
        {({ id, describedBy, invalid }) => (
          <>
            <input
              id={id}
              className={cn(inputCls, invalid && inputErrCls)}
              type="password"
              value={form.password}
              onChange={(e) => setField('password', e.target.value)}
              autoComplete="new-password"
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
            {form.password && (
              <div className="mt-2 flex items-center gap-3">
                <div
                  className="h-[3px] flex-1 overflow-hidden rounded-full bg-border-default"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={3}
                  aria-valuenow={strength.score}
                  aria-label="Password strength"
                >
                  <div
                    className={cn('h-full transition-all duration-200', barColor)}
                    style={{ width: `${(strength.score / 3) * 100}%` }}
                  />
                </div>
                <span className="w-12 text-right text-[11px] uppercase tracking-[0.06em] text-muted">
                  {strength.label}
                </span>
              </div>
            )}
          </>
        )}
      </Field>
      <Field id="su-confirm" label="Confirm password" error={errors.confirm}>
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            className={cn(inputCls, invalid && inputErrCls)}
            type="password"
            value={form.confirm}
            onChange={(e) => setField('confirm', e.target.value)}
            autoComplete="new-password"
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
          />
        )}
      </Field>
      <p className="text-[11px] text-hint">
        At least 8 characters. Mix letters, numbers, and symbols for a stronger
        password.
      </p>
    </div>
  );
};

const DepartmentStep = ({
  form,
  errors,
  setField,
  departments,
  loading,
}: StepProps & { departments: DepartmentRow[]; loading: boolean }) => (
  <Field id="su-dept" label="Department" error={errors.departmentId}>
    {({ id, describedBy, invalid }) => (
      <select
        id={id}
        className={cn(inputCls, 'pr-8', invalid && inputErrCls)}
        value={form.departmentId}
        onChange={(e) => setField('departmentId', e.target.value)}
        disabled={loading}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      >
        <option value="">{loading ? 'Loading…' : 'Select department'}</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
            {d.name_lisan ? ` · ${d.name_lisan}` : ''}
          </option>
        ))}
      </select>
    )}
  </Field>
);

const venueTypeBadge = (type: string) => {
  const cls =
    type === 'fasal_city'
      ? 'bg-purple-bg text-purple border-purple-border'
      : 'bg-info-bg text-info border-info-border';
  const label = type === 'fasal_city' ? 'Fasal' : type === 'relay_city' ? 'Relay' : type;
  return (
    <span
      className={[
        'ml-2 inline-flex h-4 items-center rounded-full border px-2 text-[10px] font-medium uppercase tracking-wide',
        cls,
      ].join(' ')}
    >
      {label}
    </span>
  );
};

const VenueStep = ({
  form,
  errors,
  setField,
  venues,
  loading,
}: StepProps & { venues: VenueRow[]; loading: boolean }) => (
  <div className="flex flex-col gap-3">
    <Field id="su-venue" label="Venue" error={errors.venueId}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          className={cn(inputCls, 'pr-8', invalid && inputErrCls)}
          value={form.venueId}
          onChange={(e) => setField('venueId', e.target.value)}
          disabled={loading || venues.length === 0}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        >
          <option value="">
            {loading
              ? 'Loading…'
              : venues.length === 0
                ? 'No venues attached to this event yet'
                : 'Select venue'}
          </option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
              {v.city ? ` (${v.city})` : ''} · {v.type === 'fasal_city' ? 'Fasal' : 'Relay'}
            </option>
          ))}
        </select>
      )}
    </Field>
    {form.venueId &&
      (() => {
        const v = venues.find((x) => x.id === form.venueId);
        if (!v) return null;
        return (
          <div className="flex items-center text-[12px] text-muted">
            Selected: <span className="ml-1 font-medium text-text">{v.name}</span>
            {venueTypeBadge(v.type)}
          </div>
        );
      })()}
  </div>
);

const ReviewRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start justify-between gap-4 border-b border-border-default py-2 last:border-0">
    <span className="text-[12px] uppercase tracking-wide text-muted">{label}</span>
    <span className="max-w-[60%] text-right text-[13px] text-text">{value || '—'}</span>
  </div>
);

const ReviewStep = ({
  form,
  event,
  departments,
  venues,
}: {
  form: FormState;
  event: DefaultEvent | null;
  departments: DepartmentRow[];
  venues: VenueRow[];
}) => {
  const dept = departments.find((d) => d.id === form.departmentId);
  const venue = venues.find((v) => v.id === form.venueId);
  return (
    <div className="rounded-sm border border-border-default bg-surface px-4 py-2">
      <ReviewRow label="Name" value={form.name} />
      <ReviewRow label="Email" value={form.email} />
      <ReviewRow label="ITS Number" value={form.itsNumber} />
      <ReviewRow label="Contact" value={form.contactNumber} />
      <ReviewRow label="Department" value={dept ? dept.name : ''} />
      <ReviewRow
        label="Venue"
        value={venue ? `${venue.name}${venue.city ? ` (${venue.city})` : ''}` : ''}
      />
      <ReviewRow
        label="Event"
        value={event ? `${event.name}${event.city ? ` · ${event.city}` : ''}` : ''}
      />
    </div>
  );
};

const SuccessScreen = () => (
  <div className="flex min-h-screen items-center justify-center bg-bg px-4">
    <div className="w-full max-w-md rounded-lg border border-success-border bg-card px-8 py-9">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-success">
        Submitted
      </p>
      <h1 className="mt-1.5 text-[24px] font-medium leading-tight tracking-[-0.01em] text-text">
        Awaiting approval
      </h1>
      <p className="mt-3 max-w-[60ch] text-[13px] leading-[1.55] text-muted">
        Your signup request has been received. A super admin will review it
        shortly. You will receive an email when your account is approved.
      </p>
      <Link
        to="/login"
        className="mt-6 inline-flex h-9 items-center rounded-sm bg-text px-5 text-[13px] font-medium text-white outline-none transition hover:opacity-90 active:translate-y-[0.5px] focus-visible:shadow-[0_0_0_3px_rgba(31,31,29,0.18)]"
      >
        Back to login
      </Link>
    </div>
  </div>
);
