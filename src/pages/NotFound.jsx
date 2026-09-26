import { Search } from '../components/icons.js';
import { EmptyState } from '../components/ui/Feedback.jsx';
import { ButtonLink } from '../components/ui/Button.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { homeFor } from '../routes/guards.jsx';

export default function NotFound() {
  const { user } = useAuth();
  return (
    <div className="card mt-6">
      <EmptyState icon={Search} title="Page not found" text="This page doesn’t exist or was moved." action={<ButtonLink to={user ? homeFor(user) : '/login'}>Go home</ButtonLink>} />
    </div>
  );
}
