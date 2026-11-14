export default function StatCard({ title, value, subtitle, icon: Icon, accent = 'blue' }) {
  const accents = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 truncate">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 tracking-tight">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`shrink-0 rounded-lg p-2.5 ${accents[accent] || accents.blue}`}>
            <Icon className="h-5 w-5" strokeWidth={2} />
          </div>
        )}
      </div>
    </div>
  );
}
