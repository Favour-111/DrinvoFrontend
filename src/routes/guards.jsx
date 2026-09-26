import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Logo } from '../components/ui/Media.jsx';

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center" aria-busy="true">
      <div className="animate-pulse">
        <Logo />
      </div>
    </div>
  );
}

export const homeFor = (user) => (user?.role === 'ADMIN' ? '/admin/dashboard' : '/staff/home');

/** Only signed-in users with one of `roles` may see the nested routes. */
export function RequireRole({ roles }) {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <Splash />;
  if (status !== 'ready') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}

export function GuestOnly({ children }) {
  const { status, user } = useAuth();
  if (status === 'loading') return <Splash />;
  if (status === 'ready') return <Navigate to={homeFor(user)} replace />;
  return children;
}

export function HomeRedirect() {
  const { status, user } = useAuth();
  if (status === 'loading') return <Splash />;
  return <Navigate to={status === 'ready' ? homeFor(user) : '/login'} replace />;
}
