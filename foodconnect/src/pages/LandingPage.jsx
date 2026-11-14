import { Link } from 'react-router-dom';
import {
  Leaf,
  ArrowRight,
  UtensilsCrossed,
  MapPin,
  GitMerge,
  Truck,
  Target,
  Recycle,
  ShieldCheck,
  BarChart3,
} from 'lucide-react';

const STATS = [
  { value: '12,400+', label: 'kg food rescued' },
  { value: '18', label: 'distribution centers' },
  { value: '49,600+', label: 'meals supported' },
  { value: '9', label: 'dining halls' },
];

const STEPS = [
  {
    icon: UtensilsCrossed,
    title: 'Report surplus food',
    desc: 'Canteen staff log leftover food with quantity, safety details, and pickup window.',
  },
  {
    icon: MapPin,
    title: 'Find eligible centers',
    desc: 'Centers within a 15-minute travel window and matching demand are shortlisted.',
  },
  {
    icon: GitMerge,
    title: 'Match intelligently',
    desc: 'Scores balance demand, capacity, travel time, and urgency in seconds.',
  },
  {
    icon: Truck,
    title: 'Collect and distribute',
    desc: 'Volunteers pick up verified food and deliver it to the matched center.',
  },
];

const FEATURES = [
  {
    icon: Target,
    title: '15-minute matching',
    desc: 'Only centers reachable within 15 minutes of travel are considered for primary matching.',
  },
  {
    icon: ShieldCheck,
    title: 'Food safety first',
    desc: 'Preparation time, storage, allergens, and verification status stay visible end-to-end.',
  },
  {
    icon: Recycle,
    title: 'Waste reduction',
    desc: 'Track redistribution rates and environmental impact with clear, estimated metrics.',
  },
  {
    icon: BarChart3,
    title: 'Campus analytics',
    desc: 'Dining halls and admins see surplus trends, category waste, and sustainability scores.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
              <Leaf className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-semibold tracking-tight text-slate-900">
              Campus FoodConnect
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden sm:inline-flex text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Sign in
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-emerald-50" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 mb-6">
              <Leaf className="h-3.5 w-3.5" />
              SDG 2 · Zero Hunger · SDG 12
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-[1.15]">
              Turning Campus Food Surplus Into Community Impact.
            </h1>
            <p className="mt-5 text-lg text-slate-600 leading-relaxed max-w-xl">
              Connect college canteens with nearby NGOs and food banks. Report surplus in
              minutes, match within a 15-minute travel window, and get food to people who need it.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Explore Platform
              </a>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-slate-200/80 bg-white/80 backdrop-blur p-4 shadow-sm"
              >
                <p className="text-2xl font-bold text-blue-600 tracking-tight">{s.value}</p>
                <p className="mt-0.5 text-sm text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 bg-slate-50 border-y border-slate-100">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              How it works
            </h2>
            <p className="mt-3 text-slate-600">
              Four clear steps from surplus to delivery — designed for campus operations.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="relative rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 mb-4">
                  <step.icon className="h-5 w-5" />
                </div>
                <span className="absolute top-5 right-5 text-3xl font-bold text-slate-100">
                  {i + 1}
                </span>
                <h3 className="font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Built for campus food systems
            </h2>
            <p className="mt-3 text-slate-600">
              Matching, safety, and sustainability in one place — ready for real operations.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="shrink-0 flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SDG */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-emerald-600">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 text-center text-white">
          <h2 className="text-2xl font-bold tracking-tight">Aligned with the UN Sustainable Development Goals</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-6">
            <div className="rounded-xl bg-white/10 backdrop-blur border border-white/20 px-8 py-5">
              <p className="text-3xl font-bold">SDG 2</p>
              <p className="mt-1 text-sm text-blue-100">Zero Hunger</p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur border border-white/20 px-8 py-5">
              <p className="text-3xl font-bold">SDG 12</p>
              <p className="mt-1 text-sm text-blue-100">Responsible Consumption</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row justify-between gap-8">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                  <Leaf className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold text-slate-900">Campus FoodConnect</span>
              </div>
              <p className="mt-3 text-sm text-slate-500 max-w-xs">
                Intelligent surplus food tracking and redistribution for college campuses.
              </p>
            </div>
            <div className="text-sm text-slate-500 space-y-1">
              <p className="font-medium text-slate-700">Contact</p>
              <p>project@campusfoodconnect.edu</p>
              <p>Campus Sustainability Office</p>
            </div>
          </div>
          <p className="mt-10 text-xs text-slate-400">
            © {new Date().getFullYear()} Campus FoodConnect. Demo frontend for educational use.
          </p>
        </div>
      </footer>
    </div>
  );
}
