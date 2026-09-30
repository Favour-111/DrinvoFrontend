import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Clock, Receipt, Store, TrendingUp } from '../../components/icons.js';
import { Logo } from '../../components/ui/Media.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { FormError, FormField, Segmented } from '../../components/ui/Form.jsx';
import { ErrorState } from '../../components/ui/Feedback.jsx';
import { useApi } from '../../hooks/useApi.js';
import { authService } from '../../services/index.js';

const schema = z
  .object({
    name: z.string().trim().min(2, 'Enter your name'),
    email: z.string().trim().email('Enter a valid email'),
    phone: z.string().trim().optional(),
    password: z.string().min(8, 'Use at least 8 characters'),
    confirmPassword: z.string(),
    shopId: z.string().optional(),
  })
  .refine((v) => v.password === v.confirmPassword, { message: 'Passwords don’t match', path: ['confirmPassword'] });

const applyServerErrors = (err, setError) => {
  if (err.fields) for (const [k, message] of Object.entries(err.fields)) setError(k, { message });
};

function Hero() {
  return (
    <div className="flex flex-col justify-between gap-8 bg-hero px-5 py-7 text-[#eaf7f0] lg:px-12 lg:py-10">
      <Logo light />
      <div>
        <h1 className="max-w-[470px] text-[32px] leading-[1.1] font-extrabold tracking-[-0.03em] lg:text-[42px]">
          Join your
          <br />
          team on
          <br />
          <span className="text-brand-3">Drinvo.</span>
        </h1>
        <p className="mt-3.5 max-w-[420px] text-[#9fc2b1]">Create your staff account, then wait for your admin to approve it before you can sign in.</p>
      </div>
      <div className="hidden max-w-[420px] flex-col gap-3 lg:flex">
        {[
          [Receipt, 'Fast sales', 'Search, add drinks, pick payment, done'],
          [Store, 'Your shop', 'You’ll only see stock and sales for your shop'],
          [TrendingUp, 'Track yourself', 'See your own sales, any time'],
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
  );
}

function Submitted({ name, businessName }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-5 py-10">
      <div className="w-full max-w-[400px] text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand-soft text-brand">
          <Clock size={26} />
        </span>
        <h2 className="mt-4 text-[22px] font-bold">Thanks, {name.split(' ')[0]}!</h2>
        <p className="mt-2 text-[13.5px] text-ink-3">
          We’ll get back to you. {businessName ? `${businessName} still` : 'An admin still'} needs to approve your account before you can sign in — check back soon.
        </p>
        <Link to="/login" className="mt-6 inline-block text-[13.5px] font-semibold text-brand-ink hover:underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

export default function Signup() {
  const { token } = useParams();
  const [done, setDone] = useState(null);
  const { data: invite, error, loading } = useApi(() => authService.invitationInfo(token), [token]);
  const { register, handleSubmit, formState, setError, watch } = useForm({ resolver: zodResolver(schema), defaultValues: { shopId: '' } });

  const submit = handleSubmit(async ({ shopId, ...values }) => {
    try {
      const result = await authService.signup({ ...values, token, ...(shopId ? { shopId } : {}) });
      setDone(result.name);
    } catch (err) {
      applyServerErrors(err, setError);
      if (!err.fields) setError('root', { message: err.message });
    }
  });

  if (done) return <Submitted name={done} businessName={invite?.businessName} />;
  if (loading && !invite) return null;
  if (error) return <ErrorState error={error} />;

  const shops = invite?.shops || [];
  const needsShopChoice = !invite?.shopId && shops.length > 1;
  const preassignedShop = invite?.shopId ? shops.find((s) => s.id === invite.shopId) : shops[0];

  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[1.05fr_1fr]">
      <Hero />
      <div className="grid place-items-center px-5 py-10">
        <div className="w-full max-w-[400px]">
          <form onSubmit={submit} noValidate className="flex w-full flex-col gap-4">
            <div>
              <h2 className="text-[24px] font-bold">Create your account</h2>
              <p className="mt-1 text-[13.5px] text-ink-3">
                Joining <b className="text-ink">{invite?.businessName}</b>
                {!needsShopChoice && preassignedShop ? ` · ${preassignedShop.name}` : ''}
              </p>
            </div>
            <FormError message={formState.errors.root?.message} />
            <FormField label="Full name" name="name" autoComplete="name" register={register} errors={formState.errors} />
            <FormField label="Email" name="email" type="email" autoComplete="username" register={register} errors={formState.errors} />
            <FormField label="Phone (optional)" name="phone" type="tel" autoComplete="tel" register={register} errors={formState.errors} />
            <FormField label="Password" name="password" type="password" autoComplete="new-password" register={register} errors={formState.errors} hint="At least 8 characters" />
            <FormField label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" register={register} errors={formState.errors} />
            {needsShopChoice && (
              <div>
                <div className="label mb-1.5">Which shop will you work at?</div>
                <Segmented
                  label="Shop"
                  value={watch('shopId')}
                  onChange={(v) => register('shopId').onChange({ target: { name: 'shopId', value: v } })}
                  options={shops.map((s) => ({ value: s.id, label: s.name }))}
                />
                {formState.errors.shopId && <p className="mt-1.5 text-[12.5px] text-bad">{formState.errors.shopId.message}</p>}
              </div>
            )}
            <Button type="submit" variant="primary" size="lg" block icon={Check} loading={formState.isSubmitting}>
              Create account
            </Button>
            <p className="text-center text-[13px] text-ink-3">
              Already approved?{' '}
              <Link to="/login" className="font-semibold text-brand-ink hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
