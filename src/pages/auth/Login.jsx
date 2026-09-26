import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Receipt, TrendingUp } from '../../components/icons.js';
import { Logo } from '../../components/ui/Media.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { FormError, FormField } from '../../components/ui/Form.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { homeFor } from '../../routes/guards.jsx';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});

export default function Login() {
  const { login, notice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(schema) });

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
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[1.05fr_1fr]">
      {/* Hero */}
      <div className="flex flex-col justify-between gap-8 bg-hero px-5 py-7 text-[#eaf7f0] lg:px-12 lg:py-10">
        <Logo light />
        <div>
          <h1 className="max-w-[470px] text-[32px] leading-[1.1] font-extrabold tracking-[-0.03em] lg:text-[42px]">
            Manage stock.
            <br />
            Track sales.
            <br />
            <span className="text-brand-3">Know your profit.</span>
          </h1>
          <p className="mt-3.5 max-w-[420px] text-[#9fc2b1]">Inventory and sales for drink businesses, counted in bottles, packs, cartons and crates.</p>
        </div>
        <div className="hidden max-w-[420px] flex-col gap-3 lg:flex">
          {[
            [Receipt, 'Every sale', 'Receipt, stock deduction and profit in one step'],
            [AlertTriangle, 'Low stock alerts', 'Know what to reorder before you run out'],
            [TrendingUp, 'Real profit', 'Cost recorded at the moment of each sale'],
          ].map(([Icon, title, text]) => (
            <div key={title} className="flex items-center gap-3 rounded-[14px] border border-white/10 bg-white/[0.05] px-4 py-3.5">
              <span className="grid size-[34px] flex-none place-items-center rounded-[10px] bg-emerald-400/15 text-emerald-300">
                <Icon size={17} />
              </span>
              <div>
                <b className="block text-[15px]">{title}</b>
                <small className="text-[12.5px] text-[#9fc2b1]">{text}</small>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="grid place-items-center px-5 py-10">
        <div className="w-full max-w-[400px]">
          <form onSubmit={submit} noValidate className="flex w-full flex-col gap-4">
            <div>
              <h2 className="text-[24px] font-bold">Welcome back</h2>
              <p className="mt-1 text-[13.5px] text-ink-3">Sign in with the email your admin gave you.</p>
            </div>
            {notice && !error && <FormError message={notice} />}
            <FormError message={error} />
            <FormField label="Email" name="email" type="email" autoComplete="username" register={register} errors={formState.errors} />
            <FormField label="Password" name="password" type="password" autoComplete="current-password" register={register} errors={formState.errors} />
            <Button type="submit" variant="primary" size="lg" block loading={formState.isSubmitting}>
              Sign in
            </Button>
            {import.meta.env.DEV && (
              <p className="text-center text-[12.5px] text-ink-3">
                Demo data: <span className="font-mono">admin@drinvo.test</span> or <span className="font-mono">john@drinvo.test</span>, password <span className="font-mono">Password123!</span>
              </p>
            )}
            <p className="text-center text-[13px] text-ink-3">New staff? Ask your admin for the sign-up link.</p>
          </form>
        </div>
      </div>
    </div>
  );
}
