import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Leaf, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { validateRegister } from '../utils/validation';

const ROLES = [
  { value: 'canteen', label: 'Canteen Coordinator' },
  { value: 'ngo', label: 'Distribution Center / NGO' },
  { value: 'volunteer', label: 'Collection Volunteer' },
  { value: 'admin', label: 'Campus Administrator' },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    organization: '',
    role: '',
  });
  const [errors, setErrors] = useState({});
  const [showPass, setShowPass] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validateRegister(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const result = register(form);
    if (result.ok) {
      toast.success('Account created');
      const map = {
        canteen: '/dashboard/canteen',
        ngo: '/dashboard/ngo',
        volunteer: '/dashboard/volunteer',
        admin: '/dashboard/admin',
      };
      navigate(map[form.role] || '/');
    }
  };

  const field = (key, label, props = {}) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label} <span className="text-red-500">*</span>
      </label>
      <input
        value={form[key]}
        onChange={set(key)}
        className={`w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 ${
          errors[key] ? 'border-red-300' : 'border-slate-200'
        }`}
        {...props}
      />
      {errors[key] && <p className="mt-1 text-xs text-red-600">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 sm:p-8">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-2 mb-8">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Leaf className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-slate-900">Campus FoodConnect</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create account</h1>
          <p className="mt-1 text-sm text-slate-500">Join the campus food redistribution network.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {field('name', 'Full name', { placeholder: 'Your name' })}
            {field('email', 'Email', { type: 'email', placeholder: 'you@campus.edu' })}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  className={`w-full rounded-lg border px-3.5 py-2.5 pr-10 text-sm outline-none transition focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 ${
                    errors.password ? 'border-red-300' : 'border-slate-200'
                  }`}
                  placeholder="Min. 6 characters"
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400"
                  onClick={() => setShowPass(!showPass)}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
            </div>
            {field('phone', 'Phone number', { placeholder: '+91 …' })}
            {field('organization', 'Organization', { placeholder: 'Canteen or NGO name' })}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                value={form.role}
                onChange={set('role')}
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 ${
                  errors.role ? 'border-red-300' : 'border-slate-200'
                }`}
              >
                <option value="">Select role</option>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              {errors.role && <p className="mt-1 text-xs text-red-600">{errors.role}</p>}
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              Create account
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
