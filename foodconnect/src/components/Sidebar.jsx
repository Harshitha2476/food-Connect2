import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  GitMerge,
  Building2,
  Truck,
  Shield,
  BarChart3,
  LogOut,
  Leaf,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV = {
  canteen: [
    { to: '/dashboard/canteen', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/dashboard/add-surplus', label: 'Add Surplus', icon: PlusCircle },
    { to: '/dashboard/matching', label: 'Matching', icon: GitMerge },
    { to: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  ],
  ngo: [
    { to: '/dashboard/ngo', label: 'Dashboard', icon: Building2 },
    { to: '/dashboard/matching', label: 'Offers', icon: GitMerge },
    { to: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  ],
  volunteer: [
    { to: '/dashboard/volunteer', label: 'My Pickups', icon: Truck },
    { to: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  ],
  admin: [
    { to: '/dashboard/admin', label: 'Admin', icon: Shield },
    { to: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/dashboard/matching', label: 'Matching', icon: GitMerge },
  ],
};

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const links = NAV[user?.role] || NAV.canteen;

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-slate-200
          flex flex-col transition-transform duration-200 ease-out
          lg:translate-x-0 lg:static lg:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center justify-between h-16 px-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Leaf className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-semibold text-slate-900 text-sm tracking-tight">
              FoodConnect
            </span>
          </div>
          <button
            type="button"
            className="lg:hidden p-1.5 rounded-md text-slate-400 hover:bg-slate-100"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={2} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-4">
          <div className="mb-3 px-1">
            <p className="text-sm font-medium text-slate-900 truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.organization}</p>
            <p className="text-xs text-slate-400 capitalize mt-0.5">{user?.role} account</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
