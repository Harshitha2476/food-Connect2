import {
  Building2,
  Users,
  Scale,
  CheckCircle2,
  Trash2,
  UserCheck,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { useFood } from '../context/FoodContext';

export default function AdminDashboard() {
  const { surplus, canteens, centers, volunteers, analytics, activity } = useFood();

  const totalSurplus = surplus.reduce((s, x) => s + Number(x.quantityKg), 0);
  const redistributed = surplus
    .filter((s) => ['matched', 'pending_collection', 'delivered'].includes(s.status))
    .reduce((s, x) => s + Number(x.quantityKg), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Administrator</h1>
        <p className="mt-1 text-sm text-slate-500">Campus-wide surplus, users, and sustainability</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="Canteens" value={canteens.length} icon={Building2} accent="blue" />
        <StatCard title="Centers" value={centers.length} icon={Building2} accent="green" />
        <StatCard title="Surplus (kg)" value={Math.round(totalSurplus)} icon={Scale} accent="blue" />
        <StatCard title="Redistributed" value={Math.round(redistributed)} icon={CheckCircle2} accent="green" />
        <StatCard title="Discarded (est.)" value={analytics.totals.totalDiscardedKg} icon={Trash2} accent="amber" />
        <StatCard title="Active users" value={volunteers.length + canteens.length + 2} icon={UserCheck} accent="slate" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Dining hall comparison</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.diningHallComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="surplus" fill="#2563EB" radius={[4, 4, 0, 0]} name="Surplus" />
                <Bar dataKey="redistributed" fill="#16A34A" radius={[4, 4, 0, 0]} name="Redistributed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Monthly surplus vs redistributed</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="surplus" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="redistributed" fill="#16A34A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tables */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Canteens</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 bg-slate-50">
                <th className="px-5 py-2.5">Name</th>
                <th className="px-5 py-2.5">Coordinator</th>
                <th className="px-5 py-2.5">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {canteens.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3 font-medium text-slate-800">{c.name}</td>
                  <td className="px-5 py-3 text-slate-600">{c.coordinator}</td>
                  <td className="px-5 py-3">
                    <span className="font-medium text-emerald-600">{c.sustainabilityScore}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Distribution centers</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 bg-slate-50">
                <th className="px-5 py-2.5">Name</th>
                <th className="px-5 py-2.5">Travel</th>
                <th className="px-5 py-2.5">Capacity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {centers.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3 font-medium text-slate-800">{c.name}</td>
                  <td className="px-5 py-3 text-slate-600">
                    {c.travelTimeMin} min{' '}
                    {c.travelTimeMin > 15 && <StatusBadge status="ineligible" />}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{c.availableCapacityKg} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400" />
          <h2 className="font-semibold text-slate-900">Recent system activity</h2>
        </div>
        <ul className="divide-y divide-slate-100">
          {activity.slice(0, 6).map((a) => (
            <li key={a.id} className="px-5 py-3 flex justify-between text-sm">
              <span className="text-slate-700">{a.message}</span>
              <span className="text-xs text-slate-400">{a.time}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
