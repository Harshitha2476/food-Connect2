import { useState } from 'react';
import { MapPin, Clock, Package, CheckCircle2, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import StatusBadge from '../components/StatusBadge';
import { useFood } from '../context/FoodContext';

const STATUS_FLOW = ['assigned', 'pickup_pending', 'collected', 'in_transit', 'delivered'];

export default function VolunteerDashboard() {
  const { pickups, updatePickupStatus } = useFood();
  const [otpInput, setOtpInput] = useState({});
  const [activeOtp, setActiveOtp] = useState(null);

  const myPickups = pickups;
  const history = pickups.filter((p) => p.status === 'delivered');

  const advance = (p) => {
    const idx = STATUS_FLOW.indexOf(p.status === 'assigned' ? 'assigned' : p.status);
    const next = STATUS_FLOW[Math.min(idx + 1, STATUS_FLOW.length - 1)];
    if (next === 'collected' || p.status === 'assigned') {
      setActiveOtp(p.id);
      return;
    }
    updatePickupStatus(p.id, next);
    toast.success(`Status updated to ${next.replace('_', ' ')}`);
  };

  const confirmOtp = (p) => {
    if (otpInput[p.id] === p.otp) {
      updatePickupStatus(p.id, 'collected');
      toast.success('Pickup verified');
      setActiveOtp(null);
    } else {
      toast.error('Invalid OTP');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Collection Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Assigned pickups, verification, and delivery tracking</p>
      </div>

      <div className="grid gap-4">
        {myPickups.filter((p) => p.status !== 'delivered').map((p) => (
          <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900">{p.foodName}</h3>
                  <StatusBadge status={p.status} />
                </div>
                <p className="mt-1 text-sm text-slate-500">{p.quantityKg} kg</p>
              </div>
              <div className="text-right text-sm text-slate-500">
                <p className="flex items-center gap-1 justify-end">
                  <Clock className="h-3.5 w-3.5" /> Deadline {p.pickupDeadline}
                </p>
                <p className="mt-0.5">~{p.travelTimeMin} min travel (demo)</p>
              </div>
            </div>

            <div className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-400 uppercase">Pickup</p>
                <p className="font-medium text-slate-800 mt-0.5">{p.canteenName}</p>
                <p className="text-slate-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3.5 w-3.5" /> {p.canteenLocation}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-400 uppercase">Destination</p>
                <p className="font-medium text-slate-800 mt-0.5">{p.centerName}</p>
                <p className="text-slate-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3.5 w-3.5" /> {p.centerAddress}
                </p>
              </div>
            </div>

            {activeOtp === p.id ? (
              <div className="mt-4 flex flex-wrap items-end gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs font-medium text-blue-800">Enter OTP from canteen</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-blue-200 px-3 py-2 text-sm"
                    placeholder="4-digit OTP"
                    maxLength={4}
                    value={otpInput[p.id] || ''}
                    onChange={(e) => setOtpInput({ ...otpInput, [p.id]: e.target.value })}
                  />
                  <p className="mt-1 text-xs text-blue-600">Demo OTP: {p.otp}</p>
                </div>
                <button
                  type="button"
                  onClick={() => confirmOtp(p)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Verify
                </button>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                {p.status !== 'delivered' && (
                  <button
                    type="button"
                    onClick={() => advance(p)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    {p.status === 'assigned' || p.status === 'pickup_pending' ? (
                      <><QrCode className="h-4 w-4" /> Confirm pickup</>
                    ) : p.status === 'collected' || p.status === 'in_transit' ? (
                      <><CheckCircle2 className="h-4 w-4" /> Mark delivered</>
                    ) : (
                      'Update status'
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {myPickups.filter((p) => p.status !== 'delivered').length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center text-slate-500 text-sm">
            No active pickups assigned.
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Collection history</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {history.map((p) => (
              <li key={p.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <span className="text-slate-700">
                  <Package className="inline h-3.5 w-3.5 mr-1.5 text-slate-400" />
                  {p.foodName} → {p.centerName}
                </span>
                <StatusBadge status="delivered" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
