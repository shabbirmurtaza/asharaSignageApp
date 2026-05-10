import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '@/lib/auth';
import { defaultRouteForRole } from '@/lib/rbac';
import { ApiError } from '@/lib/api';
import { useToast } from '@/stores/toast';
import { useDefaultEvent } from '@/hooks/useDefaultEvent';
import { accentTokens } from '@/lib/accent';

const schema = z.object({
  itsNumber: z
    .string()
    .trim()
    .regex(/^\d{8}$/, 'ITS Number must be 8 digits'),
  password: z.string().min(1, 'Password required'),
});

type FormValues = z.infer<typeof schema>;

const friendlyError = (err: unknown): string => {
  if (err instanceof ApiError) {
    const msg = err.message?.toLowerCase() ?? '';
    if (msg.includes('invalid its') || msg.includes('invalid password')) {
      return 'Incorrect ITS Number or password';
    }
    if (msg.includes('disabled') || msg.includes('not active')) {
      return 'Account disabled. Contact super admin.';
    }
    if (msg.includes('no role')) {
      return 'No role assigned yet. Contact super admin.';
    }
    return err.message || 'Login failed';
  }
  if (err instanceof Error) return err.message;
  return 'Login failed';
};

export const LoginPage = () => {
  const session = useAuth((s) => s.session);
  const login = useAuth((s) => s.login);
  const navigate = useNavigate();
  const toast = useToast();
  const { data: event } = useDefaultEvent();
  const accent = accentTokens(event?.brand_primary);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    mode: 'onSubmit',
    defaultValues: { itsNumber: '', password: '' },
  });

  useEffect(() => {
    if (session) navigate(defaultRouteForRole(session.primaryRole), { replace: true });
  }, [session, navigate]);

  if (session) {
    return <Navigate to={defaultRouteForRole(session.primaryRole)} replace />;
  }

  const onSubmit = async (values: FormValues) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FormValues;
        setError(field, { message: issue.message });
      }
      return;
    }
    setSubmitting(true);
    setServerError(null);
    try {
      const next = await login(parsed.data.itsNumber, parsed.data.password);
      toast.success('Welcome back');
      navigate(defaultRouteForRole(next.primaryRole), { replace: true });
    } catch (err) {
      const msg = friendlyError(err);
      setServerError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 bg-bg lg:grid-cols-[1.1fr_1fr]">
      {/* Identity panel */}
      <aside
        className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex"
        style={{ background: accent.tint }}
      >
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: accent.strip }}
        />
        <div>
          <p className="text-eyebrow uppercase text-muted">Ashara Mubaraka</p>
          <p className="mt-2 text-h2 text-text">Signage</p>
        </div>
        <div className="flex flex-col gap-4">
          <p
            className="font-arabic text-[64px] leading-none text-text"
            dir="rtl"
            lang="ar"
          >
            {event?.hijri_year ?? '١٤٤٧'}
          </p>
          <div className="h-px w-16" style={{ background: accent.base }} />
          <div>
            <p className="text-h1 text-text">{event?.year ?? ''}</p>
            {event?.city && (
              <p className="mt-1 text-body-sm text-muted">{event.city}</p>
            )}
          </div>
        </div>
        <p className="max-w-sm text-meta text-muted">
          Planning, approval, and production tracking for every sign at Ashara Mubaraka.
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm rounded-md border border-border-default bg-card p-8 shadow-md">
          <p className="text-eyebrow uppercase text-muted lg:hidden">Ashara Mubaraka</p>
          <h1 className="mt-1 text-h1 text-text">Sign In</h1>
          <p className="mt-1 text-body-sm text-muted">
            Sign in with your ITS Number.
          </p>

          {serverError && (
            <div
              role="alert"
              className="mt-5 rounded-sm border border-danger-border bg-danger-bg px-3 py-2 text-meta text-danger"
            >
              {serverError}
            </div>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="mt-6 flex flex-col gap-4"
            noValidate
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-meta font-medium text-text">ITS Number</span>
              <input
                {...register('itsNumber')}
                autoComplete="username"
                inputMode="numeric"
                maxLength={8}
                placeholder="8 digits"
                className="h-9 rounded-sm border border-border-strong bg-card px-3 text-body-sm outline-none focus:border-text"
              />
              {errors.itsNumber && (
                <span className="text-meta text-danger">
                  {errors.itsNumber.message}
                </span>
              )}
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-meta font-medium text-text">Password</span>
              <input
                type="password"
                {...register('password')}
                autoComplete="current-password"
                className="h-9 rounded-sm border border-border-strong bg-card px-3 text-body-sm outline-none focus:border-text"
              />
              {errors.password && (
                <span className="text-meta text-danger">
                  {errors.password.message}
                </span>
              )}
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="mt-2 h-9 rounded-sm text-body-sm font-medium transition hover:opacity-90 disabled:opacity-60"
              style={{ background: accent.base, color: accent.fg }}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-5 text-center text-meta text-muted">
            First time?{' '}
            <Link to="/signup" className="font-medium text-info hover:underline">
              Create account
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};
