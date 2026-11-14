import { Link } from 'react-router-dom';
import {
  Scale,
  CheckCircle2,
  Clock,
  Leaf,
  PlusCircle,
  List,
  GitMerge,
  Truck,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { useFood } from '../context/FoodContext';

const PIE_COLORS = ['#2563EB', '#16A34A', '#F59E0B', '#8B5CF6', '#06B6D4'];

export default function CanteenDashboard() {
  const { surplus, stats, activity, analytics, centers } = useFood();

  const eligibleCount = centers.filter((c) => c.travelTimeMin <= 15).length;

  const quickActions = [
    { to: '/dashboard/add-surplus', label: 'Add Surplus Food', icon: PlusCircle, color: 'bg-blue-600 hover:bg-blue-700 text-white' },
    { to: '/dashboard/matching', label: 'View Active Listings', icon: List, color: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50' },
    { to: '/dashboard/matching', label: 'View Matched Centers', icon: GitMerge, color: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50' },
    { to: '/dashboard/matching', label: 'Collection Status', icon: Truck, color: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Canteen Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Surplus overview, matching, and today&apos;s activity</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Surplus today" value={`${stats.totalSurplusToday} kg`} icon={Scale} accent="blue" />
        <StatCard title="Redistributed" value={`${stats.redistributed} kg`} icon={CheckCircle2} accent="green" />
        <StatCard title="Pending listings" value={stats.pendingRequests} icon={Clock} accent="amber" />
        <StatCard title="Waste avoided" value={`${stats.wasteAvoided} kg`} subtitle="Delivered so far" icon={Leaf} accent="green" />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((a) => (
            <Link
              key={a.label}
              to={a.to}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${a.color}`}
            >
              <a.icon className="h-4 w-4" />
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Matching status banner */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 flex flex-wrap items-center gap-3">
        <GitMerge className="h-5 w-5 text-emerald-600 shrink-0" />
        <p className="text-sm text-emerald-800">
          <span className="font-semibold">{eligibleCount} distribution centers</span> are within the 15-minute travel window and available for matching.
        </p>
      </div>

      {/* Food table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Surplus food overview</h2>
          <Link to="/dashboard/add-surplus" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            + Add new
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                <th className="px-5 py-3">Food</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Qty (kg)</th>
                <th className="px-5 py-3">Prep time</th>
                <th className="px-5 py-3">Safety</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {surplus.slice(0, 8).map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-medium text-slate-900">{s.foodName}</td>
                  <td className="px-5 py-3 text-slate-600">{s.category}</td>
                  <td className="px-5 py-3 text-slate-600">{s.quantityKg}</td>
                  <td className="px-5 py-3 text-slate-600">{s.preparationTime}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={s.safetyStatus} />
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={s.matchingStatus || s.status} />
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      to="/dashboard/matching"
                      className="text-blue-600 hover:text-blue-700 font-medium text-xs"
                    >
                      Match
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Daily surplus (kg)</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.dailySurplus}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="kg" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Category mix</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.categoryDistribution}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {analytics.categoryDistribution.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Weekly redistribution</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.weeklyRedistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="redistributed" stroke="#16A34A" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="discarded" stroke="#F59E0B" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Activity */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Recent activity</h2>
        </div>
        <ul className="divide-y divide-slate-100">
          {activity.slice(0, 5).map((a) => (
            <li key={a.id} className="px-5 py-3 flex items-start justify-between gap-4 text-sm">
              <span className="text-slate-700">{a.message}</span>
              <span className="text-xs text-slate-400 shrink-0">{a.time}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
