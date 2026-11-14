import { useState, useMemo } from 'react';
import { MapPin, Clock, Package, Gauge, Check, X, Info, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import { useFood } from '../context/FoodContext';
import { rankCenters, explainRanking, MAX_TRAVEL_MIN } from '../utils/matchingAlgorithm';
import StatusBadge from '../components/StatusBadge';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function MatchingDashboard() {
  const { surplus, centers, acceptMatch, rejectMatch } = useFood();
  const available = surplus.filter((s) => s.status === 'available' || s.matchingStatus === 'available');
  const [selectedId, setSelectedId] = useState(available[0]?.id || surplus[0]?.id);
  const selected = surplus.find((s) => s.id === selectedId) || surplus[0];

  const ranking = useMemo(() => {
    if (!selected) return { eligible: [], ineligible: [], all: [] };
    return rankCenters(selected, centers);
  }, [selected, centers]);

  const handleAccept = (center) => {
    if (!selected) return;
    acceptMatch(selected.id, center);
    toast.success(`Matched with ${center.name}`);
  };

  const handleReject = (center) => {
    if (!selected) return;
    rejectMatch(selected.id, center.id);
    toast.message(`Rejected ${center.name} — fallback matching available`);
  };

  if (!selected) {
    return (
      <div className="text-center py-20 text-slate-500">
        No surplus listings available for matching.
      </div>
    );
  }

  const canteenCenter = { lat: 12.9716, lng: 77.5946 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Intelligent Food Matching</h1>
        <p className="mt-1 text-sm text-slate-500">
          Centers ranked by demand, capacity, travel time (≤{MAX_TRAVEL_MIN} min), and urgency. Matching runs in seconds; travel times are illustrative demo values.
        </p>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1 space-y-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Select surplus</p>
          {surplus.slice(0, 6).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedId(s.id)}
              className={`w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                selectedId === s.id
                  ? 'border-blue-300 bg-blue-50 text-blue-900'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <span className="font-medium block truncate">{s.foodName}</span>
              <span className="text-xs text-slate-500">{s.quantityKg} kg · {s.category}</span>
            </button>
          ))}
        </div>

        <div className="lg:col-span-3 grid sm:grid-cols-4 gap-3">
          <SummaryCard icon={Package} label="Available weight" value={`${selected.quantityKg} kg`} />
          <SummaryCard icon={MapPin} label="Eligible centers" value={ranking.eligible.length} />
          <SummaryCard icon={Clock} label="Matching status" value={selected.matchingStatus || selected.status} />
          <SummaryCard icon={Gauge} label="Est. match time" value="< 2 sec" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <p className="text-sm font-medium text-slate-700 mb-2">Matching score weights</p>
        <div className="flex flex-wrap gap-4 text-xs text-slate-600">
          <span><strong className="text-slate-900">35%</strong> Demand compatibility</span>
          <span><strong className="text-slate-900">25%</strong> Capacity</span>
          <span><strong className="text-slate-900">25%</strong> Travel time</span>
          <span><strong className="text-slate-900">15%</strong> Urgency</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Ranked centers ({ranking.eligible.length} eligible)
          </h2>

          {ranking.eligible.map((center, idx) => (
            <div
              key={center.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
                      {idx + 1}
                    </span>
                    <h3 className="font-semibold text-slate-900">{center.name}</h3>
                    <StatusBadge status="eligible" />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{center.address}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600">{center.matchScore}</p>
                  <p className="text-xs text-slate-400">match score</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <Meta label="Travel time" value={`${center.travelTimeMin} min`} highlight={center.travelTimeMin <= 15} />
                <Meta label="Demand" value={`${center.demandKg} kg`} />
                <Meta label="Capacity left" value={`${center.availableCapacityKg} kg`} />
                <Meta label="Urgency" value={<StatusBadge status={center.urgency} />} />
              </div>

              <div className="mt-4 space-y-1.5">
                <ScoreBar label="Demand" value={center.breakdown.demand} weight="35%" />
                <ScoreBar label="Capacity" value={center.breakdown.capacity} weight="25%" />
                <ScoreBar label="Travel" value={center.breakdown.travel} weight="25%" />
                <ScoreBar label="Urgency" value={center.breakdown.urgency} weight="15%" />
              </div>

              <p className="mt-3 text-xs text-slate-500 flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                {explainRanking(center)}
              </p>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAccept(center)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                >
                  <Check className="h-4 w-4" /> Accept
                </button>
                <button
                  type="button"
                  onClick={() => handleReject(center)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  <X className="h-4 w-4" /> Reject
                </button>
              </div>
            </div>
          ))}

          {ranking.ineligible.length > 0 && (
            <div className="pt-2">
              <h3 className="text-sm font-semibold text-slate-500 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Outside 15-minute window (ineligible for primary matching)
              </h3>
              {ranking.ineligible.map((center) => (
                <div
                  key={center.id}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-4 mb-3 opacity-80"
                >
                  <div className="flex justify-between">
                    <div>
                      <p className="font-medium text-slate-700">{center.name}</p>
                      <p className="text-sm text-slate-500">{center.address}</p>
                    </div>
                    <StatusBadge status="ineligible" />
                  </div>
                  <p className="mt-2 text-sm text-amber-700">
                    Travel time {center.travelTimeMin} min exceeds the {MAX_TRAVEL_MIN}-minute limit.
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden sticky top-20">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Campus area (illustrative)</h3>
              <p className="text-xs text-slate-400">Markers and times are demo data, not live routing</p>
            </div>
            <div className="h-80 sm:h-96">
              <MapContainer
                center={[canteenCenter.lat, canteenCenter.lng]}
                zoom={14}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Circle
                  center={[canteenCenter.lat, canteenCenter.lng]}
                  radius={1800}
                  pathOptions={{ color: '#2563EB', fillColor: '#2563EB', fillOpacity: 0.06 }}
                />
                <Marker position={[canteenCenter.lat, canteenCenter.lng]}>
                  <Popup>Canteen (origin)</Popup>
                </Marker>
                {centers.map((c) => (
                  <Marker key={c.id} position={[c.lat, c.lng]}>
                    <Popup>
                      <strong>{c.name}</strong>
                      <br />
                      ~{c.travelTimeMin} min (demo)
                      <br />
                      {c.travelTimeMin <= 15 ? 'Eligible' : 'Ineligible'}
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500 mb-1">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-lg font-semibold text-slate-900 capitalize">{value}</p>
    </div>
  );
}

function Meta({ label, value, highlight }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`font-medium ${highlight ? 'text-emerald-600' : 'text-slate-800'}`}>{value}</p>
    </div>
  );
}

function ScoreBar({ label, value, weight }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-slate-500 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${value}%` }} />
      </div>
      <span className="w-8 text-right text-slate-600">{value}</span>
      <span className="w-8 text-slate-400">{weight}</span>
    </div>
  );
}
