import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Clock, Lock, Mail, Phone, Store, User, Receipt, TrendingUp } from '../../components/icons.js';
import { Button } from '../../components/ui/Button.jsx';
import { FormError, Segmented } from '../../components/ui/Form.jsx';
import { AuthCard, AuthField, AuthLayout } from '../../components/auth/AuthLayout.jsx';
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

const SIGNUP_FEATURES = [
  [Receipt, 'Fast sales', 'Search, add drinks, pick payment, done'],
  [Store, 'Your shop', 'You’ll only see stock and sales for your shop'],
  [TrendingUp, 'Track yourself', 'See your own sales, any time'],
];

function Submitted({ name, businessName }) {
  return (
    <AuthLayout hero={{ eyebrow: 'Almost there', title: 'Your request is in.', highlight: 'We’ll be in touch.', text: 'Your admin approves every new staff account before it can sign in.', features: SIGNUP_FEATURES }}>
      <AuthCard className="text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-[20px] bg-brand-soft text-brand shadow-[inset_0_0_0_1px_var(--line)]">
          <Clock size={28} />
        </span>
        <h2 className="mt-5 text-[22px] font-bold">Thanks, {name.split(' ')[0]}!</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-3">
          {businessName ? `${businessName} still` : 'An admin still'} needs to approve your account before you can sign in. Check back soon.
        </p>
        <Link to="/login" className="mt-7 inline-flex h-11 items-center justify-center rounded-[13px] border border-line bg-surface px-5 text-[13.5px] font-semibold text-ink shadow-[0_1px_2px_rgba(16,24,32,0.04)] transition-colors hover:bg-surface-2">
          Back to sign in
        </Link>
      </AuthCard>
    </AuthLayout>
  );
}

export default function Signup() {
  const { token } = useParams();
  const [done, setDone] = useState(null);
  const { data: invite, error, loading } = useApi(() => authService.invitationInfo(token), [token]);
  const { register, handleSubmit, formState, setError, watch, setValue } = useForm({ resolver: zodResolver(schema), defaultValues: { shopId: '' } });
  const errors = formState.errors;

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
    <AuthLayout
      hero={{
        eyebrow: 'Join your team',
        title: 'Join your team on',
        highlight: 'Drinvo.',
        text: 'Create your staff account, then wait for your admin to approve it before you can sign in.',
        features: SIGNUP_FEATURES,
      }}
    >
      <AuthCard>
        <div>
          <h2 className="text-[24px] font-bold tracking-[-0.02em]">Create your account</h2>
          <p className="mt-1.5 text-[14px] text-ink-3">
            Joining <b className="font-semibold text-ink">{invite?.businessName}</b>
            {!needsShopChoice && preassignedShop ? ` · ${preassignedShop.name}` : ''}
          </p>
        </div>
        <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-4">
          <FormError message={errors.root?.message} />
          <AuthField label="Full name" icon={User} autoComplete="name" error={errors.name?.message} {...register('name')} />
          <AuthField label="Email address" icon={Mail} type="email" autoComplete="username" error={errors.email?.message} {...register('email')} />
          <AuthField label="Phone (optional)" icon={Phone} type="tel" autoComplete="tel" error={errors.phone?.message} {...register('phone')} />
          <AuthField label="Password" icon={Lock} type="password" autoComplete="new-password" placeholder="At least 8 characters" error={errors.password?.message} {...register('password')} />
          <AuthField label="Confirm password" icon={Lock} type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
          {needsShopChoice && (
            <div>
              <div className="mb-1.5 text-[13px] font-semibold text-ink-2">Which shop will you work at?</div>
              <Segmented label="Shop" value={watch('shopId')} onChange={(v) => setValue('shopId', v, { shouldValidate: true })} options={shops.map((s) => ({ value: s.id, label: s.name }))} />
              {errors.shopId && <p className="mt-1.5 text-[12.5px] font-medium text-bad">{errors.shopId.message}</p>}
            </div>
          )}
          <Button type="submit" variant="primary" size="lg" block icon={Check} loading={formState.isSubmitting} className="mt-1 h-[52px] rounded-[15px] text-[15px]">
            Create account
          </Button>
        </form>
      </AuthCard>
      <p className="mt-6 text-center text-[13.5px] text-ink-3">
        Already approved?{' '}
        <Link to="/login" className="font-semibold text-brand-ink hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
