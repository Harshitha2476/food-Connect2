import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    const fallback = {
      canteen: '/dashboard/canteen',
      ngo: '/dashboard/ngo',
      volunteer: '/dashboard/volunteer',
      admin: '/dashboard/admin',
    };
    return <Navigate to={fallback[user.role] || '/'} replace />;
  }

  return children;
}
