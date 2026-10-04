import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, KeyRound, Lock, Mail } from '../../components/icons.js';
import { FormError } from '../../components/ui/Form.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { AuthCard, AuthField, AuthLayout, AUTH_FEATURES } from '../../components/auth/AuthLayout.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { homeFor } from '../../routes/guards.jsx';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});

const DEMO = { email: 'admin@drinvo.test', password: 'Password123!' };

export default function Login() {
  const { login, notice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState, setValue } = useForm({ resolver: zodResolver(schema) });

  const submit = handleSubmit(async ({ email, password }) => {
    setError('');
    try {
      const user = await login(email, password);
      const from = location.state?.from;
      const allowed = from && from.startsWith(user.role === 'ADMIN' ? '/admin' : '/staff');
      navigate(allowed ? from : homeFor(user), { replace: true });
    } catch (err) {
      setError(err.message);
    }
  });

  return (
    <AuthLayout
      hero={{
        eyebrow: 'All-in-one drink business solution',
        title: (
          <>
            Manage stock.
            <br />
            Track sales.
          </>
        ),
        highlight: 'Know your profit.',
        text: 'Inventory and sales for drink businesses, counted in bottles, packs, cartons and crates.',
        features: AUTH_FEATURES,
        footer: (
          <>
            <span className="flex -space-x-2">
              {['AO', 'TB', 'BE'].map((i) => (
                <span key={i} className="grid size-8 place-items-center rounded-full border-2 border-hero bg-brand-soft text-[10.5px] font-bold text-brand-ink">
                  {i}
                </span>
              ))}
              <span className="grid h-8 place-items-center rounded-full border-2 border-hero bg-brand-3 px-2.5 text-[11px] font-bold text-hero">1K+</span>
            </span>
            <span>
              Trusted by drink shop owners
              <br />
              and retailers.
            </span>
          </>
        ),
      }}
    >
      <AuthCard>
        <div className="flex flex-col items-center text-center">
          <span className="grid size-16 place-items-center rounded-[20px] bg-linear-to-br from-brand-2 to-brand shadow-[0_14px_30px_-12px_rgba(16,185,129,0.8)]">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9.5 2.5h5v3l2 3.2c.3.5.5 1.1.5 1.7V19a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 7 19v-8.6c0-.6.2-1.2.5-1.7l2-3.2z" fill="#fff" />
              <path d="M7 13.5h10" stroke="#047857" strokeWidth="2" />
            </svg>
          </span>
          <span className="mt-3 text-[22px] font-extrabold tracking-[-0.03em]">Drinvo</span>
        </div>

        <div className="mt-7">
          <h2 className="text-[24px] font-bold tracking-[-0.02em]">Welcome back</h2>
          <p className="mt-1.5 text-[14px] text-ink-3">Sign in with the email your admin gave you.</p>
        </div>

        <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-4">
          {notice && !error && <FormError message={notice} />}
          <FormError message={error} />
          <AuthField label="Email address" icon={Mail} type="email" autoComplete="username" placeholder="you@business.com" error={formState.errors.email?.message} {...register('email')} />
          <AuthField
            label="Password"
            icon={Lock}
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Enter your password"
            toggle
            visible={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
            error={formState.errors.password?.message}
            {...register('password')}
          />
          <Button type="submit" variant="primary" size="lg" block loading={formState.isSubmitting} className="mt-1 h-[52px] rounded-[15px] text-[15px]">
            Sign in
            <ArrowRight size={18} />
          </Button>
        </form>

        {import.meta.env.DEV && (
          <>
            <div className="my-5 flex items-center gap-3 text-[12px] font-medium text-ink-3">
              <span className="h-px flex-1 bg-line" />
              OR
              <span className="h-px flex-1 bg-line" />
            </div>
            <button
              type="button"
              onClick={() => {
                setError('');
                setValue('email', DEMO.email, { shouldValidate: true });
                setValue('password', DEMO.password, { shouldValidate: true });
              }}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[15px] border border-line bg-surface-2 text-[13.5px] font-semibold text-ink-2 transition-colors hover:border-brand/30 hover:bg-brand-soft/50 hover:text-brand-ink"
            >
              <KeyRound size={16} />
              Fill in the demo account
              <ArrowRight size={15} />
            </button>
          </>
        )}
      </AuthCard>

      <p className="mt-6 text-center text-[13px] text-ink-3">New staff? Ask your admin for the sign-up link.</p>
    </AuthLayout>
  );
}
