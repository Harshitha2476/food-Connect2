import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Save, X, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useFood } from '../context/FoodContext';
import { useAuth } from '../context/AuthContext';
import { FOOD_CATEGORIES } from '../data/mockData';
import { validateSurplusForm } from '../utils/validation';

const empty = {
  foodName: '',
  category: '',
  quantityKg: '',
  preparationDate: new Date().toISOString().slice(0, 10),
  preparationTime: '',
  storageMethod: '',
  storageTemp: '',
  ingredients: '',
  allergens: '',
  pickupDeadline: '',
  location: '',
  notes: '',
  photo: null,
};

export default function AddSurplusFood() {
  const { addSurplus, saveDraft } = useFood();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [preview, setPreview] = useState(null);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image');
      return;
    }
    setForm({ ...form, photo: file.name });
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validateSurplusForm(form);
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error('Please fix the highlighted fields');
      return;
    }
    addSurplus({
      ...form,
      quantityKg: Number(form.quantityKg),
      canteenId: 'c1',
      canteenName: user?.organization || 'Main Campus Canteen',
    });
    toast.success('Surplus food submitted. Safety verification is pending.');
    navigate('/dashboard/canteen');
  };

  const handleDraft = () => {
    saveDraft({ ...form, canteenName: user?.organization });
    toast.success('Draft saved locally');
  };

  const fieldClass = (key) =>
    `w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 ${
      errors[key] ? 'border-red-300' : 'border-slate-200'
    }`;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Add Surplus Food</h1>
        <p className="mt-1 text-sm text-slate-500">
          Log leftover food for matching. Safety status stays pending until checks are complete.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 space-y-6">
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Food name <span className="text-red-500">*</span>
            </label>
            <input className={fieldClass('foodName')} value={form.foodName} onChange={set('foodName')} placeholder="e.g. Vegetable Biryani" />
            {errors.foodName && <p className="mt-1 text-xs text-red-600">{errors.foodName}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Category <span className="text-red-500">*</span>
            </label>
            <select className={fieldClass('category')} value={form.category} onChange={set('category')}>
              <option value="">Select category</option>
              {FOOD_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Quantity (kg) <span className="text-red-500">*</span>
            </label>
            <input type="number" min="0.1" step="0.1" className={fieldClass('quantityKg')} value={form.quantityKg} onChange={set('quantityKg')} placeholder="0.0" />
            {errors.quantityKg && <p className="mt-1 text-xs text-red-600">{errors.quantityKg}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Preparation date <span className="text-red-500">*</span>
            </label>
            <input type="date" className={fieldClass('preparationDate')} value={form.preparationDate} onChange={set('preparationDate')} />
            {errors.preparationDate && <p className="mt-1 text-xs text-red-600">{errors.preparationDate}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Preparation time <span className="text-red-500">*</span>
            </label>
            <input type="time" className={fieldClass('preparationTime')} value={form.preparationTime} onChange={set('preparationTime')} />
            {errors.preparationTime && <p className="mt-1 text-xs text-red-600">{errors.preparationTime}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Storage method <span className="text-red-500">*</span>
            </label>
            <select className={fieldClass('storageMethod')} value={form.storageMethod} onChange={set('storageMethod')}>
              <option value="">Select</option>
              <option value="Hot holding">Hot holding</option>
              <option value="Refrigerated">Refrigerated</option>
              <option value="Room temperature">Room temperature</option>
              <option value="Frozen">Frozen</option>
            </select>
            {errors.storageMethod && <p className="mt-1 text-xs text-red-600">{errors.storageMethod}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Storage temperature</label>
            <input className={fieldClass('storageTemp')} value={form.storageTemp} onChange={set('storageTemp')} placeholder="e.g. 65°C or 4°C" />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Known ingredients</label>
            <input className={fieldClass('ingredients')} value={form.ingredients} onChange={set('ingredients')} placeholder="Comma-separated" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Allergen information</label>
            <input className={fieldClass('allergens')} value={form.allergens} onChange={set('allergens')} placeholder="e.g. Gluten, Dairy, None" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Pickup deadline <span className="text-red-500">*</span>
            </label>
            <input type="time" className={fieldClass('pickupDeadline')} value={form.pickupDeadline} onChange={set('pickupDeadline')} />
            {errors.pickupDeadline && <p className="mt-1 text-xs text-red-600">{errors.pickupDeadline}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Canteen location <span className="text-red-500">*</span>
            </label>
            <input className={fieldClass('location')} value={form.location} onChange={set('location')} placeholder="Building / floor" />
            {errors.location && <p className="mt-1 text-xs text-red-600">{errors.location}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Additional notes</label>
            <textarea
              rows={2}
              className={fieldClass('notes')}
              value={form.notes}
              onChange={set('notes')}
              placeholder="Any extra context for collectors or centers"
            />
          </div>

          {/* Photo */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Food photograph</label>
            <div className="flex flex-wrap items-start gap-4">
              <label className="flex flex-col items-center justify-center w-36 h-28 rounded-lg border-2 border-dashed border-slate-200 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors">
                <Upload className="h-6 w-6 text-slate-400 mb-1" />
                <span className="text-xs text-slate-500">Upload image</span>
                <input type="file" accept="image/*" className="hidden" onChange={onFile} />
              </label>
              {preview ? (
                <img src={preview} alt="Preview" className="h-28 w-36 object-cover rounded-lg border border-slate-200" />
              ) : (
                <div className="h-28 w-36 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-slate-300" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          Food safety verification will show as <strong>pending</strong> after submission until applicable checks are completed. Do not treat form completion alone as a safety clearance.
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            Submit Surplus Food
          </button>
          <button
            type="button"
            onClick={handleDraft}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Save className="h-4 w-4" />
            Save draft
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
