import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Leaf, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { validateLogin } from '../utils/validation';

const DEMO_ROLES = [
  { role: 'canteen', label: 'Canteen Coordinator', email: 'canteen@campus.edu' },
  { role: 'ngo', label: 'Distribution Center / NGO', email: 'ngo@hopekitchen.org' },
  { role: 'volunteer', label: 'Collection Volunteer', email: 'volunteer@campus.edu' },
  { role: 'admin', label: 'Campus Administrator', email: 'admin@campus.edu' },
];

export default function Login() {
  const { login, loginAsRole } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', remember: false });
  const [errors, setErrors] = useState({});
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const goToDashboard = (role) => {
    const map = {
      canteen: '/dashboard/canteen',
      ngo: '/dashboard/ngo',
      volunteer: '/dashboard/volunteer',
      admin: '/dashboard/admin',
    };
    navigate(map[role] || '/dashboard/canteen');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validateLogin(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    const result = login(form.email, form.password);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error || 'Login failed');
      return;
    }
    toast.success(`Welcome, ${result.user.name}`);
    goToDashboard(result.user.role);
  };

  const quickLogin = (role) => {
    const result = loginAsRole(role);
    if (result.ok) {
      toast.success(`Signed in as ${result.user.name}`);
      goToDashboard(role);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 p-12 flex-col justify-between text-white">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
            <Leaf className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">Campus FoodConnect</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold leading-tight">
            Surplus food deserves a second chance.
          </h1>
          <p className="mt-4 text-blue-100 text-lg max-w-md">
            Match campus leftovers with nearby centers in minutes — safely, transparently, and at scale.
          </p>
        </div>
        <p className="text-sm text-blue-200">Demo credentials available on the right →</p>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Leaf className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-slate-900">Campus FoodConnect</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sign in</h2>
          <p className="mt-1.5 text-sm text-slate-500">
            Use demo credentials or pick a role below.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 ${
                  errors.email ? 'border-red-300' : 'border-slate-200'
                }`}
                placeholder="you@campus.edu"
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className={`w-full rounded-lg border px-3.5 py-2.5 pr-10 text-sm outline-none transition focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 ${
                    errors.password ? 'border-red-300' : 'border-slate-200'
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPass(!showPass)}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.remember}
                  onChange={(e) => setForm({ ...form, remember: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Remember me
              </label>
              <button type="button" className="text-blue-600 hover:text-blue-700 font-medium">
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {loading ? 'Signing in…' : 'Sign in'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            No account?{' '}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-700">
              Register
            </Link>
          </p>

          {/* Demo roles */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
              Quick demo login
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEMO_ROLES.map((r) => (
                <button
                  key={r.role}
                  type="button"
                  onClick={() => quickLogin(r.role)}
                  className="text-left rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                >
                  <span className="font-medium text-slate-800 block">{r.label}</span>
                  <span className="text-xs text-slate-400">{r.email}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">Passwords: canteen123 / ngo123 / volunteer123 / admin123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
