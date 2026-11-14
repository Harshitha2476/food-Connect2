const STYLES = {
  available: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  matched: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  pending_collection: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  verified: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  assigned: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  in_transit: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  collected: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  delivered: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  rejected: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  high: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  medium: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  low: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  eligible: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  ineligible: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
};

const LABELS = {
  available: 'Available',
  matched: 'Matched',
  pending: 'Pending',
  pending_collection: 'Pending Collection',
  verified: 'Verified',
  assigned: 'Assigned',
  in_transit: 'In Transit',
  collected: 'Collected',
  delivered: 'Delivered',
  rejected: 'Rejected',
  high: 'High Urgency',
  medium: 'Medium',
  low: 'Low',
  eligible: 'Eligible',
  ineligible: 'Ineligible',
};

export default function StatusBadge({ status, label }) {
  const key = (status || '').toLowerCase().replace(/\s+/g, '_');
  const style = STYLES[key] || 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
  const text = label || LABELS[key] || status;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {text}
    </span>
  );
}
