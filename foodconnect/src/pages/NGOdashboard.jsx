import { useState } from 'react';
import { Package, CheckCircle2, Clock, Inbox, Plus } from 'lucide-react';
import { toast } from 'sonner';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { useFood } from '../context/FoodContext';
import { FOOD_CATEGORIES } from '../data/mockData';

export default function NGOdashboard() {
  const { surplus, pickups, acceptMatch, centers } = useFood();
  const myCenter = centers[0]; // Hope Kitchen for demo
  const offers = surplus.filter((s) => s.status === 'available' || s.matchingStatus === 'available');
  const accepted = surplus.filter((s) => s.matchedCenterId === myCenter?.id || s.status === 'matched');
  const pendingPickups = pickups.filter((p) => p.centerName === myCenter?.name && p.status !== 'delivered');

  const [showDemand, setShowDemand] = useState(false);
  const [demand, setDemand] = useState({
    categories: [],
    quantityKg: '',
    capacityKg: myCenter?.availableCapacityKg || 50,
    urgency: 'medium',
    dietary: '',
  });

  const toggleCat = (c) => {
    setDemand((d) => ({
      ...d,
      categories: d.categories.includes(c)
        ? d.categories.filter((x) => x !== c)
        : [...d.categories, c],
    }));
  };

  const saveDemand = (e) => {
    e.preventDefault();
    toast.success('Demand preferences updated (demo)');
    setShowDemand(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Distribution Center</h1>
          <p className="mt-1 text-sm text-slate-500">{myCenter?.name} · Incoming offers and capacity</p>
        </div>
        <button
          type="button"
          onClick={() => setShowDemand(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Update demand
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Available offers" value={offers.length} icon={Inbox} accent="blue" />
        <StatCard title="Accepted food" value={accepted.length} icon={CheckCircle2} accent="green" />
        <StatCard title="Pending pickups" value={pendingPickups.length} icon={Clock} accent="amber" />
        <StatCard
          title="Capacity left"
          value={`${myCenter?.availableCapacityKg ?? 0} kg`}
          icon={Package}
          accent="slate"
        />
      </div>

      {/* Incoming offers */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Incoming food offers</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {offers.length === 0 && (
            <p className="px-5 py-8 text-sm text-slate-500 text-center">No open offers right now.</p>
          )}
          {offers.map((s) => (
            <div key={s.id} className="px-5 py-4 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-slate-900">{s.foodName}</h3>
                  <StatusBadge status={s.safetyStatus} />
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {s.quantityKg} kg · {s.category} · Prep {s.preparationTime} · Deadline {s.pickupDeadline}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Storage: {s.storageMethod} {s.storageTemp && `(${s.storageTemp})`} · Allergens: {s.allergens || '—'}
                </p>
                {s.ingredients && (
                  <p className="mt-0.5 text-xs text-slate-400">Ingredients: {s.ingredients}</p>
                )}
                <p className="mt-0.5 text-xs text-slate-400">From: {s.canteenName} · {s.location}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    acceptMatch(s.id, myCenter);
                    toast.success(`Accepted ${s.foodName}`);
                  }}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => toast.message('Offer declined')}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Demand form modal */}
      {showDemand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Register demand</h3>
            <form onSubmit={saveDemand} className="mt-4 space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Categories needed</p>
                <div className="flex flex-wrap gap-2">
                  {FOOD_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCat(c)}
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                        demand.categories.includes(c)
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity required (kg)</label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={demand.quantityKg}
                  onChange={(e) => setDemand({ ...demand, quantityKg: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Storage capacity (kg)</label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={demand.capacityKg}
                  onChange={(e) => setDemand({ ...demand, capacityKg: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Urgency</label>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={demand.urgency}
                  onChange={(e) => setDemand({ ...demand, urgency: e.target.value })}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dietary requirements</label>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={demand.dietary}
                  onChange={(e) => setDemand({ ...demand, dietary: e.target.value })}
                  placeholder="e.g. vegetarian only"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white">
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowDemand(false)}
                  className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
