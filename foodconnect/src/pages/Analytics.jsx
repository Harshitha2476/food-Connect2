import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { Leaf, Utensils, Droplets, Wind } from 'lucide-react';
import { useFood } from '../context/FoodContext';

const PIE_COLORS = ['#2563EB', '#16A34A', '#F59E0B', '#8B5CF6', '#06B6D4'];

export default function Analytics() {
  const { analytics } = useFood();
  const t = analytics.totals;
  const rate = t.totalSurplusKg > 0
    ? ((t.totalRedistributedKg / t.totalSurplusKg) * 100).toFixed(1)
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Food Waste Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sustainability metrics. Environmental figures and meal counts are estimates based on configurable assumptions.
        </p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total surplus</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{t.totalSurplusKg.toLocaleString()} kg</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Redistributed</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{t.totalRedistributedKg.toLocaleString()} kg</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Discarded</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{t.totalDiscardedKg.toLocaleString()} kg</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <p className="text-sm text-emerald-700">Redistribution rate</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{rate}%</p>
          <p className="mt-1 text-xs text-emerald-600">
            (Redistributed ÷ Surplus) × 100
          </p>
        </div>
      </div>

      {/* Impact estimates */}
      <div className="grid sm:grid-cols-3 gap-4">
        <ImpactCard icon={Utensils} label="Est. meals supported" value={t.mealsSupported.toLocaleString()} note="~4 servings per kg (estimate)" />
        <ImpactCard icon={Wind} label="Est. CO₂ avoided" value={`${t.co2SavedKg.toLocaleString()} kg`} note="Illustrative conversion factor" />
        <ImpactCard icon={Droplets} label="Est. water saved" value={`${(t.waterSavedL / 1000).toFixed(0)}k L`} note="Illustrative conversion factor" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Monthly trends</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="surplus" stroke="#64748B" strokeWidth={2} />
                <Line type="monotone" dataKey="redistributed" stroke="#16A34A" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Category-wise share</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.categoryDistribution}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {analytics.categoryDistribution.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Dining hall performance</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.diningHallComparison} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="surplus" fill="#94A3B8" name="Surplus kg" radius={[0, 4, 4, 0]} />
              <Bar dataKey="redistributed" fill="#16A34A" name="Redistributed kg" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 flex gap-3 text-sm text-blue-800">
        <Leaf className="h-5 w-5 shrink-0" />
        <p>
          Environmental and meal metrics are <strong>estimates</strong> for demonstration.
          Configure conversion factors (meals per kg, CO₂, water) when connecting a real backend.
        </p>
      </div>
    </div>
  );
}

function ImpactCard({ icon: Icon, label, value, note }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500 mb-2">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{note}</p>
    </div>
  );
}
