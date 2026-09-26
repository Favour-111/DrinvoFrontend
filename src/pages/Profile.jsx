import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LogOut } from '../components/icons.js';
import { Page, PageHeader } from '../components/ui/Nav.jsx';
import { Card, MiniStat } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Tag } from '../components/ui/Badge.jsx';
import { FormField } from '../components/ui/Form.jsx';
import { Avatar } from '../components/ui/Media.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { authService, reportService } from '../services/index.js';
import { session } from '../services/api.js';
import { money } from '../utils/format.js';

const profileSchema = z.object({ name: z.string().trim().min(2, 'Enter your name'), phone: z.string().trim().max(40).optional() });
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'Use at least 8 characters'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords don’t match' });

/** Shared by admin and staff. Staff also see their own sales totals. */
export default function Profile({ staff }) {
  const { user, shop, logout, updateUser } = useAuth();
  const toast = useToast();
  const mine = useApi(() => (staff ? reportService.me() : Promise.resolve(null)), [staff]);
  const profile = useForm({ resolver: zodResolver(profileSchema), defaultValues: { name: user.name, phone: user.phone } });
  const pw = useForm({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } });

  const saveProfile = profile.handleSubmit(async (v) => {
    try {
      updateUser(await authService.updateMe(v));
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(err.message);
    }
  });
  const savePassword = pw.handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      const { token } = await authService.changePassword({ currentPassword, newPassword });
      session.setToken(token);
      pw.reset();
      toast.success('Password changed.');
    } catch (err) {
      pw.setError('currentPassword', { message: err.message });
    }
  });

  return (
    <Page className={staff ? 'mx-auto w-full max-w-[640px]' : ''}>
      {!staff && <PageHeader title="Profile" subtitle="Your account details." />}
      <div className={staff ? 'grid gap-4' : 'grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]'}>
        <Card className="flex flex-col items-center gap-2.5 self-start text-center">
          <Avatar user={user} size={80} />
          <h2 className="text-[20px] font-bold">{user.name}</h2>
          <Tag>
            {user.role === 'ADMIN' ? 'Admin' : 'Staff'} · {shop?.name}
          </Tag>
          <p className="text-ink-3">{user.email}</p>
          <Button className="mt-2" icon={LogOut} onClick={logout}>
            Sign out
          </Button>
        </Card>
        <div className="grid gap-4">
          {staff && mine.data && (
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Sales this month" value={money(mine.data.monthSales)} />
              <MiniStat label="Sales today" value={money(mine.data.todaySales)} />
            </div>
          )}
          <Card>
            <form onSubmit={saveProfile} className="grid gap-3.5">
              <h3 className="text-[16px] font-semibold">Details</h3>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <FormField label="Full name" name="name" register={profile.register} errors={profile.formState.errors} />
                <FormField label="Phone" name="phone" type="tel" register={profile.register} errors={profile.formState.errors} />
              </div>
              <FormField label="Email" name="email" register={() => ({ value: user.email, readOnly: true })} errors={{}} hint="Ask an admin to change your sign-in email." />
              <div className="flex justify-end">
                <Button type="submit" variant="primary" loading={profile.formState.isSubmitting}>
                  Save details
                </Button>
              </div>
            </form>
          </Card>
          <Card>
            <form onSubmit={savePassword} className="grid gap-3.5">
              <h3 className="text-[16px] font-semibold">Change password</h3>
              <FormField label="Current password" name="currentPassword" type="password" autoComplete="current-password" register={pw.register} errors={pw.formState.errors} />
              <div className="grid gap-3.5 sm:grid-cols-2">
                <FormField label="New password" name="newPassword" type="password" autoComplete="new-password" register={pw.register} errors={pw.formState.errors} />
                <FormField label="Confirm new password" name="confirm" type="password" autoComplete="new-password" register={pw.register} errors={pw.formState.errors} />
              </div>
              <div className="flex justify-end">
                <Button type="submit" loading={pw.formState.isSubmitting}>
                  Change password
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </Page>
  );
}
