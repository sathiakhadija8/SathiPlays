'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Line } from 'react-chartjs-2';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { BackgroundShell } from '../layout/BackgroundShell';
import { usePlatformWindowOpen } from '../../lib/use-platform-window-open';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

type Recipe = {
  id: number;
  title: string;
  description: string | null;
  image_path: string | null;
  pcos_tags: string | null;
  meal_tags: string | null;
  protein_g_per_portion: number;
  carbs_g_per_portion: number;
  fat_g_per_portion: number;
};

type RecipeDetails = {
  id: number;
  title: string;
  description: string | null;
  image_path: string | null;
  pcos_tags: string | null;
  meal_tags: string | null;
  protein_g_per_portion: number;
  carbs_g_per_portion: number;
  fat_g_per_portion: number;
  steps: Array<{ id: number; step_text: string; order_index: number }>;
  ingredients: Array<{ id: number; ingredient_name: string; qty_per_portion: number; unit: string }>;
};

type InventoryItem = {
  id: number;
  ingredient_name: string;
  image_path: string | null;
  quantity: number;
  unit: string;
  low_stock_threshold: number;
  location?: 'pantry' | 'fridge' | 'freezer';
};

type BatchRecipe = {
  id: number;
  batch_id: number;
  recipe_id: number;
  portions_cooked: number;
  portions_remaining: number;
  recipe_title: string;
};
type Batch = {
  id: number;
  cooked_at: string;
  expires_at: string;
  status: 'active' | 'finished' | 'expired';
  recipes: BatchRecipe[];
};

type GroceryItem = { id: number; item_name: string; quantity: number | null; unit: string | null; status: 'pending' | 'bought' };
type PlanItem = {
  id: number;
  plan_date: string;
  meal_slot: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'suhoor' | 'iftar';
  recipe_id: number;
  planned_portions: number;
  recipe_title: string;
};

type FoodSummary = {
  fasting_status: {
    plan_name: string | null;
    fast_type: string | null;
    state: 'FASTING' | 'EATING WINDOW';
    minutes_to_next_state: number | null;
    has_open_session: boolean;
    session_started_at: string | null;
  };
  active_batches: Batch[];
  planned_upcoming: PlanItem[];
  grocery_pending: GroceryItem[];
  low_stock_items: InventoryItem[];
  today_macro_totals: { protein_g: number; carbs_g: number; fat_g: number };
  macros_7d: Array<{ day: string; protein_g: number; carbs_g: number; fat_g: number }>;
  pcos_aligned_count: number;
};

type PlanPayload = { week_start_date: string; items: PlanItem[] };

type RecipePayload = {
  title: string;
  description?: string;
  image_path?: string;
  meal_tags: string[];
  pcos_tags: string[];
  protein_g_per_portion: number;
  carbs_g_per_portion: number;
  fat_g_per_portion: number;
  ingredients: Array<{ ingredient_name: string; qty_per_portion: number; unit: string }>;
  steps: Array<{ step_text: string; order_index: number }>;
};

const MEAL_TAGS = ['Suhoor', 'Iftar', 'Lunch', 'Dinner', 'Snack'];
const PCOS_TAGS = ['low_carb', 'high_protein', 'low_gi', 'anti_inflammatory'];

function glassCard(extra = '') {
  return `rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.60)] backdrop-blur-xl ${extra}`;
}

function parseJsonTags(raw: string | null | undefined) {
  if (!raw) return [] as string[];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    return [];
  }
}

function minutesText(minutes: number | null) {
  if (minutes == null) return '--';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function expiresInDays(expiresAt: string) {
  const now = Date.now();
  const end = new Date(expiresAt).getTime();
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
}

function BaseModal({
  open,
  title,
  onClose,
  children,
  maxWidthClass = 'max-w-3xl',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClass?: string;
}) {
  const [mounted, setMounted] = useState(false);
  usePlatformWindowOpen(open);
  useEffect(() => setMounted(true), []);
  if (!open || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className={`${glassCard(`flex h-[min(88vh,840px)] w-full ${maxWidthClass} flex-col p-4`)}`}>
        <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
          <h3 className="font-serif text-2xl text-[#F8F4FF]">{title}</h3>
          <button onClick={onClose} className="rounded-full border border-white/20 px-3 py-1 text-xs text-[#F8F4FF]">Close</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

function PortalBubble({
  title,
  subtitle,
  actionLabel,
  onAction,
  floatClass,
}: {
  title: string;
  subtitle: string;
  actionLabel: string;
  onAction: () => void | Promise<void>;
  floatClass: string;
}) {
  return (
    <div className={`food-bubble ${floatClass} relative flex h-[clamp(10.5rem,14.5vw,13rem)] w-[clamp(10.5rem,14.5vw,13rem)] flex-col items-center justify-center rounded-full border border-white/10 bg-[rgba(18,16,40,0.50)] p-3.5 text-center shadow-[0_0_20px_rgba(255,62,165,0.15)] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_0_28px_rgba(255,62,165,0.22)]`}>
      <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_28%_20%,rgba(255,255,255,0.18),transparent_54%),radial-gradient(circle_at_76%_84%,rgba(192,132,252,0.16),transparent_58%)]" />
      <h3 className="relative font-serif text-[1.45rem] text-[#F8F4FF]">{title}</h3>
      <p className="relative mt-1 text-[11px] text-[#B9B4D9]">{subtitle}</p>
      <button onClick={() => void onAction()} className="relative mt-2.5 rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-2.5 py-1 text-[10px] text-[#F8F4FF]">
        {actionLabel}
      </button>
    </div>
  );
}

function StartFastModal({
  open,
  onClose,
  onStarted,
}: {
  open: boolean;
  onClose: () => void;
  onStarted: () => Promise<void>;
}) {
  const [fastType, setFastType] = useState<'ramadan_dry' | '18:6' | 'omad' | 'custom'>('ramadan_dry');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('14:00');

  return (
    <BaseModal open={open} title="Start a fast" onClose={onClose} maxWidthClass="max-w-lg">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'ramadan_dry', label: 'Ramadan dry' },
            { id: '18:6', label: '18:6 window' },
            { id: 'omad', label: 'OMAD' },
            { id: 'custom', label: 'Custom' },
          ].map((o) => (
            <button
              key={o.id}
              onClick={() => setFastType(o.id as typeof fastType)}
              className={`rounded-xl border px-3 py-2 text-left text-sm ${fastType === o.id ? 'border-[#FF3EA566] bg-[#FF3EA522] text-[#F8F4FF]' : 'border-white/20 text-[#B9B4D9]'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {(fastType === '18:6' || fastType === 'custom') && (
          <div className="grid grid-cols-2 gap-2">
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-[#F8F4FF]" />
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-[#F8F4FF]" />
          </div>
        )}
        <button
          onClick={async () => {
            await fetch('/api/food/fasting/start', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fast_type: fastType,
                start_time: fastType === '18:6' || fastType === 'custom' ? startTime : undefined,
                end_time: fastType === '18:6' || fastType === 'custom' ? endTime : undefined,
              }),
            });
            await onStarted();
            onClose();
          }}
          className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-4 py-1.5 text-sm text-[#F8F4FF]"
        >
          Start fast
        </button>
      </div>
    </BaseModal>
  );
}

function CookModeModal({
  open,
  recipes,
  inventory,
  onClose,
  onFinished,
}: {
  open: boolean;
  recipes: Recipe[];
  inventory: InventoryItem[];
  onClose: () => void;
  onFinished: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [details, setDetails] = useState<Record<number, RecipeDetails>>({});
  const [playMode, setPlayMode] = useState(false);
  const [recipeIndex, setRecipeIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [search, setSearch] = useState('');
  const [mealFilter, setMealFilter] = useState('');
  const [pcosFilter, setPcosFilter] = useState('');

  const selectedList = useMemo(
    () =>
      Object.entries(selected)
        .map(([k, v]) => ({ recipe_id: Number(k), portions_cooked: Number(v) }))
        .filter((v) => v.portions_cooked > 0),
    [selected],
  );

  const playRecipes = useMemo(() => selectedList.map((r) => details[r.recipe_id]).filter(Boolean), [selectedList, details]);
  const activeRecipe = playRecipes[recipeIndex] ?? null;
  const activeSteps = activeRecipe?.steps ?? [];
  const activeStep = activeSteps[stepIndex] ?? null;
  const filteredRecipes = useMemo(
    () =>
      recipes.filter((recipe) => {
        const mealTags = parseJsonTags(recipe.meal_tags);
        const pcosTags = parseJsonTags(recipe.pcos_tags);
        const queryOk = !search.trim() || recipe.title.toLowerCase().includes(search.trim().toLowerCase());
        const mealOk = !mealFilter || mealTags.includes(mealFilter);
        const pcosOk = !pcosFilter || pcosTags.includes(pcosFilter);
        return queryOk && mealOk && pcosOk;
      }),
    [recipes, search, mealFilter, pcosFilter],
  );

  const missingIngredients = useMemo(() => {
    const invByName = new Map<string, number>();
    for (const i of inventory) invByName.set(i.ingredient_name.toLowerCase(), Number(i.quantity ?? 0));

    const required = new Map<string, { name: string; qty: number; unit: string }>();
    for (const selection of selectedList) {
      const recipe = details[selection.recipe_id];
      if (!recipe) continue;
      for (const ing of recipe.ingredients) {
        const key = `${ing.ingredient_name.toLowerCase()}__${ing.unit}`;
        const prev = required.get(key);
        const nextQty = (prev?.qty ?? 0) + Number(ing.qty_per_portion) * selection.portions_cooked;
        required.set(key, { name: ing.ingredient_name, qty: nextQty, unit: ing.unit });
      }
    }

    return Array.from(required.values()).filter((req) => {
      const have = invByName.get(req.name.toLowerCase()) ?? 0;
      return have < req.qty;
    });
  }, [details, inventory, selectedList]);

  useEffect(() => {
    if (!open) {
      setSelected({});
      setDetails({});
      setPlayMode(false);
      setRecipeIndex(0);
      setStepIndex(0);
      return;
    }
    void (async () => {
      const loaded = await Promise.all(
        recipes.map(async (r) => {
          const response = await fetch(`/api/food/recipes/${r.id}`, { cache: 'no-store' });
          if (!response.ok) return null;
          return (await response.json()) as RecipeDetails;
        }),
      );
      const map: Record<number, RecipeDetails> = {};
      for (const item of loaded) if (item) map[item.id] = item;
      setDetails(map);
    })();
  }, [open, recipes]);

  return (
    <BaseModal open={open} title="Cook mode" onClose={onClose}>
      {!playMode ? (
        <div className="space-y-3">
          <p className="text-sm text-[#B9B4D9]">Select recipes and portions, then start step-by-step cooking.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recipes"
              className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-[#F8F4FF]"
            />
            <select value={mealFilter} onChange={(e) => setMealFilter(e.target.value)} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-[#F8F4FF]">
              <option value="">Meal tag</option>
              {MEAL_TAGS.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
            <select value={pcosFilter} onChange={(e) => setPcosFilter(e.target.value)} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-[#F8F4FF]">
              <option value="">PCOS tag</option>
              {PCOS_TAGS.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          </div>

          <div className="grid max-h-[34vh] grid-cols-2 gap-2 overflow-y-auto pr-1 md:grid-cols-3">
            {filteredRecipes.map((r) => (
              <div key={r.id} className="rounded-xl border border-white/10 bg-black/20 p-2">
                <div className="aspect-[4/3] overflow-hidden rounded-lg border border-white/10 bg-black/25">
                  {r.image_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image_path} alt={r.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-[10px] text-[#B9B4D9]">No image</div>
                  )}
                </div>
                <p className="mt-1 truncate text-xs text-[#F8F4FF]">{r.title}</p>
                <input
                  type="number"
                  min={0}
                  value={selected[r.id] ?? 0}
                  onChange={(e) => setSelected((prev) => ({ ...prev, [r.id]: Math.max(0, Number(e.target.value)) }))}
                  className="mt-1 w-16 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-[#F8F4FF]"
                />
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs text-[#B9B4D9]">Inventory check</p>
            {missingIngredients.length === 0 ? (
              <p className="text-sm text-[#F8F4FF]">No missing ingredients.</p>
            ) : (
              <div className="mt-1 space-y-1">
                {missingIngredients.map((item) => (
                  <p key={`${item.name}-${item.unit}`} className="text-sm text-[#F8F4FF]">
                    {item.name} • need {item.qty.toFixed(1)} {item.unit}
                  </p>
                ))}
              </div>
            )}
            {missingIngredients.length > 0 && (
              <button
                onClick={async () => {
                  for (const item of missingIngredients) {
                    await fetch('/api/food/grocery', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ item_name: item.name, quantity: item.qty, unit: item.unit }),
                    });
                  }
                }}
                className="mt-2 rounded-full border border-white/20 px-3 py-1 text-xs text-[#F8F4FF]"
              >
                Add missing to grocery
              </button>
            )}
          </div>

          <button onClick={() => setPlayMode(true)} className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-4 py-1.5 text-sm text-[#F8F4FF]">Start cooking</button>
        </div>
      ) : (
        <div className="grid h-full place-items-center text-center">
          {!activeRecipe || !activeStep ? (
            <div>
              <p className="font-serif text-3xl text-[#F8F4FF]">Cooking complete</p>
              <button
                onClick={async () => {
                  if (selectedList.length === 0) return;
                  await fetch('/api/food/batches/finish', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recipes: selectedList }),
                  });
                  await onFinished();
                  onClose();
                }}
                className="mt-4 rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-6 py-2 text-[#F8F4FF]"
              >
                Finish cooking
              </button>
            </div>
          ) : (
            <div>
              <p className="text-xs text-[#B9B4D9]">{activeRecipe.title}</p>
              <p className="mt-2 font-serif text-3xl text-[#F8F4FF]">{activeStep.step_text}</p>
              <p className="mt-1 text-xs text-[#B9B4D9]">Step {stepIndex + 1}/{activeSteps.length}</p>
              <button
                onClick={() => {
                  if (stepIndex < activeSteps.length - 1) {
                    setStepIndex((v) => v + 1);
                    return;
                  }
                  if (recipeIndex < playRecipes.length - 1) {
                    setRecipeIndex((v) => v + 1);
                    setStepIndex(0);
                    return;
                  }
                  setRecipeIndex(playRecipes.length);
                  setStepIndex(0);
                }}
                className="mt-5 rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-8 py-2 text-[#F8F4FF]"
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </BaseModal>
  );
}

function MealLogModal({
  open,
  batches,
  fastingState,
  prefillBatchRecipeId,
  onClose,
  onSaved,
}: {
  open: boolean;
  batches: Batch[];
  fastingState: 'FASTING' | 'EATING WINDOW';
  prefillBatchRecipeId: number | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [mode, setMode] = useState<'cooked' | 'cheat'>('cooked');
  const [batchRecipeId, setBatchRecipeId] = useState('');
  const [portions, setPortions] = useState('1');
  const [loggedAt, setLoggedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [cheatTitle, setCheatTitle] = useState('');
  const [cheatNotes, setCheatNotes] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const options = useMemo(() => batches.flatMap((b) => b.recipes), [batches]);

  useEffect(() => {
    if (!open) return;
    setLoggedAt(new Date().toISOString().slice(0, 16));
    if (prefillBatchRecipeId) {
      setMode('cooked');
      setBatchRecipeId(String(prefillBatchRecipeId));
    }
  }, [open, prefillBatchRecipeId]);

  return (
    <BaseModal open={open} title="Meal log" onClose={onClose} maxWidthClass="max-w-xl">
      <div className="space-y-3">
        {fastingState === 'FASTING' && <p className="rounded-xl border border-[#FF3EA566] bg-[#FF3EA522] px-3 py-2 text-xs text-[#F8F4FF]">You are currently fasting.</p>}

        <div className="flex gap-2">
          <button onClick={() => setMode('cooked')} className={`rounded-full border px-3 py-1 text-xs ${mode === 'cooked' ? 'border-[#FF3EA566] bg-[#FF3EA522] text-[#F8F4FF]' : 'border-white/20 text-[#B9B4D9]'}`}>Cooked meal</button>
          <button onClick={() => setMode('cheat')} className={`rounded-full border px-3 py-1 text-xs ${mode === 'cheat' ? 'border-[#FF3EA566] bg-[#FF3EA522] text-[#F8F4FF]' : 'border-white/20 text-[#B9B4D9]'}`}>Cheat meal</button>
        </div>

        <label className="block text-xs text-[#B9B4D9]">
          Time
          <input type="datetime-local" value={loggedAt} onChange={(e) => setLoggedAt(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-[#F8F4FF]" />
        </label>

        {mode === 'cooked' ? (
          <div className="space-y-2">
            <select value={batchRecipeId} onChange={(e) => setBatchRecipeId(e.target.value)} className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-sm text-[#F8F4FF]">
              <option value="">Select cooked recipe</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>{o.recipe_title} ({o.portions_remaining} left)</option>
              ))}
            </select>
            <input type="number" min={1} value={portions} onChange={(e) => setPortions(e.target.value)} className="w-24 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-[#F8F4FF]" />
            <button
              onClick={async () => {
                await fetch('/api/food/meals', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    log_type: 'cooked',
                    batch_recipe_id: Number(batchRecipeId),
                    portions: Number(portions || 1),
                    logged_at: loggedAt.replace('T', ' '),
                  }),
                });
                await onSaved();
                onClose();
              }}
              className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-4 py-1.5 text-sm text-[#F8F4FF]"
            >
              Save cooked meal
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input value={cheatTitle} onChange={(e) => setCheatTitle(e.target.value)} placeholder="Cheat meal title" className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-sm text-[#F8F4FF]" />
            <textarea value={cheatNotes} onChange={(e) => setCheatNotes(e.target.value)} rows={3} placeholder="Notes (optional)" className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-sm text-[#F8F4FF]" />
            <div className="grid grid-cols-3 gap-2">
              <input value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="Protein" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-[#F8F4FF]" />
              <input value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="Carbs" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-[#F8F4FF]" />
              <input value={fat} onChange={(e) => setFat(e.target.value)} placeholder="Fat" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-[#F8F4FF]" />
            </div>
            <button
              onClick={async () => {
                await fetch('/api/food/meals', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    log_type: 'cheat',
                    cheat_title: cheatTitle,
                    cheat_notes: cheatNotes,
                    cheat_protein_g: protein ? Number(protein) : undefined,
                    cheat_carbs_g: carbs ? Number(carbs) : undefined,
                    cheat_fat_g: fat ? Number(fat) : undefined,
                    logged_at: loggedAt.replace('T', ' '),
                  }),
                });
                await onSaved();
                onClose();
              }}
              className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-4 py-1.5 text-sm text-[#F8F4FF]"
            >
              Save cheat meal
            </button>
          </div>
        )}
      </div>
    </BaseModal>
  );
}

function PlannedMealsCard({
  items,
  onOpenPlan,
  onOpenGrocery,
}: {
  items: PlanItem[];
  onOpenPlan: () => void;
  onOpenGrocery: () => void;
}) {
  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    // Past planned meals are removed from UI by filtering out plan_date < today.
    return items.filter((i) => i.plan_date >= today);
  }, [items]);

  const weekDays = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }).map((_, index) => {
      const d = new Date(today);
      d.setDate(today.getDate() + index);
      const dateKey = d.toISOString().slice(0, 10);
      return {
        key: dateKey,
        label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        date: d.getDate(),
        isToday: index === 0,
      };
    });
  }, []);

  const groupedByDay = useMemo(() => {
    const map = new Map<string, PlanItem[]>();
    for (const item of upcoming) {
      const list = map.get(item.plan_date) ?? [];
      list.push(item);
      map.set(item.plan_date, list);
    }
    return map;
  }, [upcoming]);

  return (
    <section className={glassCard('min-h-0 h-full overflow-hidden p-2')}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-serif text-xl text-[#F8F4FF]">Planned meals</h2>
        <div className="flex gap-2">
          <button onClick={onOpenPlan} className="rounded-full border border-[#C084FC66] bg-[#C084FC22] px-3 py-1 text-xs text-[#F8F4FF]">Plan week</button>
          <button onClick={onOpenGrocery} className="rounded-full border border-white/20 px-3 py-1 text-xs text-[#F8F4FF]">Grocery List</button>
        </div>
      </div>
      <div className="grid max-h-[108px] grid-cols-7 gap-1 overflow-y-auto pr-1">
        {weekDays.map((day) => {
          const dayMeals = groupedByDay.get(day.key) ?? [];
          return (
            <div
              key={day.key}
              className={`rounded-lg border p-1 ${day.isToday ? 'border-[#FF3EA566] bg-[#FF3EA514]' : 'border-white/10 bg-black/20'}`}
            >
              <p className="text-center text-[9px] text-[#B9B4D9]">{day.label}</p>
              <p className="text-center text-[10px] text-[#F8F4FF]">{day.date}</p>
              <div className="mt-0.5 space-y-0.5">
                {dayMeals.slice(0, 2).map((item) => (
                  <div key={item.id} className="rounded border border-white/10 bg-white/5 px-1 py-[1px]">
                    <p className="truncate text-[9px] text-[#F8F4FF]">{item.recipe_title}</p>
                    <p className="truncate text-[9px] uppercase tracking-wide text-[#B9B4D9]">{item.meal_slot}</p>
                  </div>
                ))}
                {dayMeals.length > 2 && <p className="text-center text-[9px] text-[#C084FC]">+{dayMeals.length - 2} more</p>}
                {dayMeals.length === 0 && <div className="h-5 rounded border border-dashed border-white/10 bg-black/10" />}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MacroCard({
  totals,
  chartRows,
  pcosAligned,
}: {
  totals: { protein_g: number; carbs_g: number; fat_g: number } | null;
  chartRows: Array<{ day: string; protein_g: number; carbs_g: number; fat_g: number }>;
  pcosAligned: number;
}) {
  const [mode, setMode] = useState<'today' | '7d'>('today');

  const data = useMemo(() => {
    if (mode === 'today') {
      return {
        labels: ['Protein', 'Carbs', 'Fat'],
        datasets: [
          {
            label: 'Today',
            data: [Number(totals?.protein_g ?? 0), Number(totals?.carbs_g ?? 0), Number(totals?.fat_g ?? 0)],
            borderColor: '#FF3EA5',
            backgroundColor: 'rgba(255,62,165,0.18)',
            tension: 0.3,
            fill: true,
          },
        ],
      };
    }
    return {
      labels: chartRows.map((r) => r.day.slice(5)),
      datasets: [
        { label: 'Protein', data: chartRows.map((r) => Number(r.protein_g ?? 0)), borderColor: '#FF3EA5', backgroundColor: 'rgba(255,62,165,0.12)', tension: 0.35, fill: true },
        { label: 'Carbs', data: chartRows.map((r) => Number(r.carbs_g ?? 0)), borderColor: '#C084FC', backgroundColor: 'rgba(192,132,252,0.08)', tension: 0.35, fill: true },
        { label: 'Fat', data: chartRows.map((r) => Number(r.fat_g ?? 0)), borderColor: '#F8F4FF', backgroundColor: 'rgba(248,244,255,0.06)', tension: 0.35, fill: true },
      ],
    };
  }, [mode, totals, chartRows]);

  return (
    <section className={glassCard('min-h-0 h-full overflow-hidden p-1.5')}>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-serif text-xl text-[#F8F4FF]">Macros</h2>
        <div className="flex gap-2">
          <button onClick={() => setMode('today')} className={`rounded-full border px-2 py-0.5 text-[10px] ${mode === 'today' ? 'border-[#FF3EA566] bg-[#FF3EA522] text-[#F8F4FF]' : 'border-white/20 text-[#B9B4D9]'}`}>Today</button>
          <button onClick={() => setMode('7d')} className={`rounded-full border px-2 py-0.5 text-[10px] ${mode === '7d' ? 'border-[#FF3EA566] bg-[#FF3EA522] text-[#F8F4FF]' : 'border-white/20 text-[#B9B4D9]'}`}>7 days</button>
        </div>
      </div>

      <div className="mb-1 rounded-full border border-[#C084FC66] bg-[#C084FC22] px-2 py-0.5 text-center text-[10px] text-[#F8F4FF]">
        PCOS-aligned meals: {pcosAligned}
      </div>

      <div className="mb-1 grid grid-cols-3 gap-1">
        <div className="rounded-md border border-white/10 bg-black/20 p-1 text-center"><p className="text-[9px] text-[#B9B4D9]">Protein</p><p className="text-[11px] text-[#F8F4FF]">{Number(totals?.protein_g ?? 0).toFixed(1)}g</p></div>
        <div className="rounded-md border border-white/10 bg-black/20 p-1 text-center"><p className="text-[9px] text-[#B9B4D9]">Carbs</p><p className="text-[11px] text-[#F8F4FF]">{Number(totals?.carbs_g ?? 0).toFixed(1)}g</p></div>
        <div className="rounded-md border border-white/10 bg-black/20 p-1 text-center"><p className="text-[9px] text-[#B9B4D9]">Fat</p><p className="text-[11px] text-[#F8F4FF]">{Number(totals?.fat_g ?? 0).toFixed(1)}g</p></div>
      </div>

      <div className="h-[74px]">
        <Line
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: mode === '7d',
                labels: { color: '#F8F4FF', boxWidth: 8, boxHeight: 8, font: { size: 9 } },
              },
            },
            elements: { point: { radius: mode === '7d' ? 1.5 : 0 }, line: { borderWidth: 1.6 } },
            scales: {
              x: { ticks: { color: '#B9B4D9', font: { size: 8 }, maxTicksLimit: 6 }, grid: { color: 'rgba(255,255,255,0.05)' } },
              y: { ticks: { color: '#B9B4D9', font: { size: 8 }, maxTicksLimit: 4 }, grid: { color: 'rgba(255,255,255,0.05)' } },
            },
          }}
        />
      </div>
    </section>
  );
}

function InventoryCard({
  inventory,
  lowStock,
  onRefresh,
}: {
  inventory: InventoryItem[];
  lowStock: InventoryItem[];
  onRefresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [ingredient, setIngredient] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('g');
  const [threshold, setThreshold] = useState('');
  const [drafts, setDrafts] = useState<Record<number, { quantity: string; low_stock_threshold: string }>>({});
  const [editingId, setEditingId] = useState<number | null>(null);

  return (
    <>
      <section className={glassCard('min-h-0 h-full overflow-hidden p-2.5')}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-serif text-xl text-[#F8F4FF]">Inventory</h2>
          <button onClick={() => setOpen(true)} className="rounded-full border border-[#C084FC66] bg-[#C084FC22] px-3 py-1 text-xs text-[#F8F4FF]">+ Add inventory</button>
        </div>

        <div className="max-h-[168px] grid grid-cols-3 gap-1 overflow-y-auto pr-1 md:grid-cols-4">
          {inventory.map((item) => {
            const low = Number(item.quantity) <= Number(item.low_stock_threshold);
            const draft = drafts[item.id] ?? { quantity: String(item.quantity), low_stock_threshold: String(item.low_stock_threshold) };
            return (
              <div key={item.id} className={`rounded border p-0.5 ${low ? 'border-[#FF3EA544] bg-[#FF3EA511]' : 'border-white/10 bg-black/20'}`}>
                <div className="mb-0.5 h-8 overflow-hidden rounded border border-white/10 bg-black/25">
                  {item.image_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image_path} alt={item.ingredient_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-[9px] text-[#B9B4D9]">No image</div>
                  )}
                </div>
                <p className="truncate text-[9px] text-[#F8F4FF]">{item.ingredient_name}</p>
                <p className="text-[9px] text-[#B9B4D9]">{item.quantity} {item.unit}</p>
                <div className="mt-0.5 flex items-center gap-1">
                  <button onClick={() => setEditingId((prev) => (prev === item.id ? null : item.id))} className="rounded border border-white/20 px-1 py-0.5 text-[8px] text-[#F8F4FF]">Edit</button>
                  <button
                    onClick={async () => {
                      await fetch(`/api/food/inventory/${item.id}`, { method: 'DELETE' });
                      await onRefresh();
                    }}
                    className="rounded border border-[#FF3EA544] px-1 py-0.5 text-[8px] text-[#FF9AD0]"
                  >
                    Del
                  </button>
                </div>
                {editingId === item.id && (
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    <input
                      value={draft.quantity}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [item.id]: { ...draft, quantity: e.target.value } }))}
                      className="w-full rounded border border-white/10 bg-black/30 px-1 py-0.5 text-[9px] text-[#F8F4FF]"
                    />
                    <input
                      value={draft.low_stock_threshold}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [item.id]: { ...draft, low_stock_threshold: e.target.value } }))}
                      className="w-full rounded border border-white/10 bg-black/30 px-1 py-0.5 text-[9px] text-[#F8F4FF]"
                    />
                    <button
                      onClick={async () => {
                        await fetch(`/api/food/inventory/${item.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ quantity: Number(draft.quantity || 0), low_stock_threshold: Number(draft.low_stock_threshold || 0) }),
                        });
                        await onRefresh();
                        setEditingId(null);
                      }}
                      className="col-span-2 rounded border border-white/20 px-1 py-0.5 text-[9px] text-[#F8F4FF]"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {inventory.length === 0 && <p className="col-span-4 text-sm text-[#B9B4D9]">No inventory items yet.</p>}
          {inventory.length > 0 && lowStock.length === 0 && <p className="col-span-4 text-xs text-[#B9B4D9]">No low stock items.</p>}
        </div>
      </section>

      <BaseModal open={open} title="Add inventory" onClose={() => setOpen(false)} maxWidthClass="max-w-lg">
        <div className="space-y-2">
          <input value={ingredient} onChange={(e) => setIngredient(e.target.value)} placeholder="Ingredient" className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-[#F8F4FF]" />
          <input
            type="file"
            accept="image/*"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const form = new FormData();
              form.append('file', file);
              const response = await fetch('/api/food/inventory/upload-image', { method: 'POST', body: form });
              const payload = (await response.json()) as { image_path?: string };
              if (payload.image_path) setImagePath(payload.image_path);
            }}
            className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-[#F8F4FF]"
          />
          {imagePath && (
            <div className="h-16 w-16 overflow-hidden rounded-md border border-white/10 bg-black/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePath} alt="Inventory preview" className="h-full w-full object-cover" />
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Quantity" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-[#F8F4FF]" />
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-[#F8F4FF]">
              <option value="g">g</option>
              <option value="kg">kg</option>
              <option value="ml">ml</option>
              <option value="L">L</option>
              <option value="pcs">pcs</option>
            </select>
            <input value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="Threshold" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-[#F8F4FF]" />
          </div>
          <button
            onClick={async () => {
              await fetch('/api/food/inventory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ingredient_name: ingredient, image_path: imagePath || null, quantity: Number(qty || 0), unit, low_stock_threshold: Number(threshold || 0) }),
              });
              setIngredient('');
              setImagePath('');
              setQty('');
              setThreshold('');
              await onRefresh();
              setOpen(false);
            }}
            className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-4 py-1.5 text-sm text-[#F8F4FF]"
          >
            Save
          </button>
        </div>
      </BaseModal>
    </>
  );
}

function PlanWeekModal({
  open,
  plan,
  recipes,
  onClose,
  onSaved,
}: {
  open: boolean;
  plan: PlanPayload | null;
  recipes: Recipe[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack' | 'suhoor' | 'iftar'>('dinner');
  const [recipeId, setRecipeId] = useState('');
  const [portions, setPortions] = useState('1');

  return (
    <BaseModal open={open} title="Plan week" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-[#F8F4FF]" />
          <select value={slot} onChange={(e) => setSlot(e.target.value as typeof slot)} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-[#F8F4FF]">
            <option value="breakfast">breakfast</option>
            <option value="lunch">lunch</option>
            <option value="dinner">dinner</option>
            <option value="snack">snack</option>
            <option value="suhoor">suhoor</option>
            <option value="iftar">iftar</option>
          </select>
          <select value={recipeId} onChange={(e) => setRecipeId(e.target.value)} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-[#F8F4FF]">
            <option value="">Recipe</option>
            {recipes.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
          <input type="number" min={1} value={portions} onChange={(e) => setPortions(e.target.value)} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-[#F8F4FF]" />
          <button
            onClick={async () => {
              if (!date || !recipeId) return;
              const items = [...(plan?.items ?? []), { plan_date: date, meal_slot: slot, recipe_id: Number(recipeId), planned_portions: Number(portions || 1) }];
              await fetch('/api/food/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ week_start_date: plan?.week_start_date, items }),
              });
              await onSaved();
            }}
            className="rounded-full border border-[#C084FC66] bg-[#C084FC22] px-3 py-1 text-sm text-[#F8F4FF]"
          >
            Add
          </button>
        </div>

        <div className="space-y-1">
          {(plan?.items ?? []).map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-2 py-1">
              <p className="truncate text-xs text-[#F8F4FF]">{item.plan_date} • {item.meal_slot} • {item.recipe_title}</p>
              <button
                onClick={async () => {
                  await fetch(`/api/food/plan/item/${item.id}`, { method: 'DELETE' });
                  await onSaved();
                }}
                className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-[#B9B4D9]"
              >x</button>
            </div>
          ))}
        </div>
      </div>
    </BaseModal>
  );
}

function GroceryModal({
  open,
  items,
  onClose,
  onRefresh,
}: {
  open: boolean;
  items: GroceryItem[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [text, setText] = useState('');

  return (
    <BaseModal open={open} title="Grocery list" onClose={onClose} maxWidthClass="max-w-lg">
      <div className="space-y-3">
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add grocery item" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-[#F8F4FF]" />
          <button
            onClick={async () => {
              if (!text.trim()) return;
              await fetch('/api/food/grocery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item_name: text.trim() }),
              });
              setText('');
              await onRefresh();
            }}
            className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-3 py-1 text-xs text-[#F8F4FF]"
          >
            Add
          </button>
        </div>

        <div className="space-y-1">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-2 py-1">
              <p className="text-sm text-[#F8F4FF]">{item.item_name}</p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await fetch(`/api/food/grocery/${item.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'bought' }),
                    });
                    await onRefresh();
                  }}
                  className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-[#B9B4D9]"
                >Bought</button>
                <button
                  onClick={async () => {
                    await fetch(`/api/food/grocery/${item.id}`, { method: 'DELETE' });
                    await onRefresh();
                  }}
                  className="rounded-full border border-[#FF3EA544] px-2 py-0.5 text-[10px] text-[#FF9AD0]"
                >Delete</button>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-[#B9B4D9]">No pending grocery items.</p>}
        </div>
      </div>
    </BaseModal>
  );
}

function RecipeBookModal({
  open,
  recipes,
  activeBatches,
  onClose,
  onRefresh,
  onOpenMealLog,
}: {
  open: boolean;
  recipes: Recipe[];
  activeBatches: Batch[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onOpenMealLog: (batchRecipeId?: number) => void;
}) {
  const [tab, setTab] = useState<'recipes' | 'cooked'>('recipes');
  const [query, setQuery] = useState('');
  const [mealFilter, setMealFilter] = useState('');
  const [pcosFilter, setPcosFilter] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mealTags, setMealTags] = useState<string[]>([]);
  const [pcosTags, setPcosTags] = useState<string[]>([]);
  const [imagePath, setImagePath] = useState('');
  const [protein, setProtein] = useState('0');
  const [carbs, setCarbs] = useState('0');
  const [fat, setFat] = useState('0');
  const [ingredientsRows, setIngredientsRows] = useState<Array<{ ingredient_name: string; qty_per_portion: string; unit: string }>>([
    { ingredient_name: '', qty_per_portion: '', unit: '' },
  ]);
  const [stepsRows, setStepsRows] = useState<Array<{ step_text: string }>>([{ step_text: '' }]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setMealTags([]);
    setPcosTags([]);
    setImagePath('');
    setProtein('0');
    setCarbs('0');
    setFat('0');
    setIngredientsRows([{ ingredient_name: '', qty_per_portion: '', unit: '' }]);
    setStepsRows([{ step_text: '' }]);
  };

  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      const meal = parseJsonTags(recipe.meal_tags);
      const pcos = parseJsonTags(recipe.pcos_tags);
      const queryOk = !query.trim() || recipe.title.toLowerCase().includes(query.trim().toLowerCase());
      const mealOk = !mealFilter || meal.includes(mealFilter);
      const pcosOk = !pcosFilter || pcos.includes(pcosFilter);
      return queryOk && mealOk && pcosOk;
    });
  }, [recipes, query, mealFilter, pcosFilter]);

  const onEditRecipe = async (id: number) => {
    const res = await fetch(`/api/food/recipes/${id}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = (await res.json()) as RecipeDetails;
    setEditingId(id);
    setTitle(data.title ?? '');
    setDescription(data.description ?? '');
    setMealTags(parseJsonTags(data.meal_tags));
    setPcosTags(parseJsonTags(data.pcos_tags));
    setImagePath(data.image_path ?? '');
    setProtein(String(data.protein_g_per_portion ?? 0));
    setCarbs(String(data.carbs_g_per_portion ?? 0));
    setFat(String(data.fat_g_per_portion ?? 0));
    setIngredientsRows(
      data.ingredients.length > 0
        ? data.ingredients.map((i) => ({
            ingredient_name: i.ingredient_name,
            qty_per_portion: String(Number(i.qty_per_portion)),
            unit: i.unit,
          }))
        : [{ ingredient_name: '', qty_per_portion: '', unit: '' }],
    );
    setStepsRows(
      data.steps.length > 0
        ? data.steps
            .sort((a, b) => a.order_index - b.order_index)
            .map((s) => ({ step_text: s.step_text }))
        : [{ step_text: '' }],
    );
  };

  const buildPayload = (): RecipePayload => {
    const ingredients = ingredientsRows
      .map((row) => ({
        ingredient_name: row.ingredient_name.trim(),
        qty_per_portion: Number(row.qty_per_portion || 0),
        unit: row.unit.trim(),
      }))
      .filter((v) => v.ingredient_name && v.unit && Number.isFinite(v.qty_per_portion) && v.qty_per_portion > 0);

    const steps = stepsRows
      .map((row, index) => ({ step_text: row.step_text.trim(), order_index: index }))
      .filter((step) => step.step_text);

    return {
      title: title.trim(),
      description: description.trim(),
      image_path: imagePath || undefined,
      meal_tags: mealTags,
      pcos_tags: pcosTags,
      protein_g_per_portion: Number(protein || 0),
      carbs_g_per_portion: Number(carbs || 0),
      fat_g_per_portion: Number(fat || 0),
      ingredients,
      steps,
    };
  };

  const submitRecipe = async () => {
    const payload = buildPayload();
    if (!payload.title) return;

    const url = editingId ? `/api/food/recipes/${editingId}` : '/api/food/recipes';
    const method = editingId ? 'PATCH' : 'POST';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    await onRefresh();
    resetForm();
  };

  return (
    <BaseModal open={open} title="Recipe Book" onClose={onClose} maxWidthClass="max-w-6xl">
      <div className="mb-3 flex gap-2">
        <button onClick={() => setTab('recipes')} className={`rounded-full border px-3 py-1 text-xs ${tab === 'recipes' ? 'border-[#FF3EA566] bg-[#FF3EA522] text-[#F8F4FF]' : 'border-white/20 text-[#B9B4D9]'}`}>Recipes</button>
        <button onClick={() => setTab('cooked')} className={`rounded-full border px-3 py-1 text-xs ${tab === 'cooked' ? 'border-[#FF3EA566] bg-[#FF3EA522] text-[#F8F4FF]' : 'border-white/20 text-[#B9B4D9]'}`}>Cooked meals</button>
      </div>

      {tab === 'recipes' ? (
        <div className="grid min-h-0 grid-cols-1 gap-3 lg:grid-cols-[44%_56%]">
          <div className="min-h-0 rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="mb-2 grid grid-cols-1 gap-2">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search recipe" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-[#F8F4FF]" />
              <div className="grid grid-cols-2 gap-2">
                <select value={mealFilter} onChange={(e) => setMealFilter(e.target.value)} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-[#F8F4FF]">
                  <option value="">Meal tag</option>
                  {MEAL_TAGS.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                </select>
                <select value={pcosFilter} onChange={(e) => setPcosFilter(e.target.value)} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-[#F8F4FF]">
                  <option value="">PCOS tag</option>
                  {PCOS_TAGS.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                </select>
              </div>
            </div>

            <div className="max-h-[56vh] space-y-1 overflow-y-auto pr-1">
              {filteredRecipes.map((recipe) => (
                <div key={recipe.id} className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 overflow-hidden rounded-md border border-white/10 bg-black/25">
                      {recipe.image_path ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={recipe.image_path} alt={recipe.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-[9px] text-[#B9B4D9]">No</div>
                      )}
                    </div>
                    <p className="truncate text-sm text-[#F8F4FF]">{recipe.title}</p>
                  </div>
                  <div className="mt-1 flex gap-2">
                    <button onClick={() => void onEditRecipe(recipe.id)} className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-[#F8F4FF]">Edit</button>
                    <button
                      onClick={async () => {
                        await fetch(`/api/food/recipes/${recipe.id}`, { method: 'DELETE' });
                        if (editingId === recipe.id) resetForm();
                        await onRefresh();
                      }}
                      className="rounded-full border border-[#FF3EA544] px-2 py-0.5 text-[10px] text-[#FF9AD0]"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {filteredRecipes.length === 0 && <p className="text-sm text-[#B9B4D9]">No recipes found.</p>}
            </div>
          </div>

          <div className="min-h-0 rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="mb-2 font-serif text-xl text-[#F8F4FF]">{editingId ? 'Edit recipe' : 'Create recipe'}</p>
            <div className="grid max-h-[56vh] grid-cols-1 gap-2 overflow-y-auto pr-1">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-[#F8F4FF]" />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={2} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-[#F8F4FF]" />
              <input
                type="file"
                accept="image/*"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const form = new FormData();
                  form.append('file', file);
                  const response = await fetch('/api/food/recipes/upload-image', { method: 'POST', body: form });
                  const payload = (await response.json()) as { image_path?: string };
                  if (payload.image_path) setImagePath(payload.image_path);
                }}
                className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-[#F8F4FF]"
              />
              {imagePath && (
                <div className="h-24 w-24 overflow-hidden rounded-lg border border-white/10 bg-black/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePath} alt="Recipe preview" className="h-full w-full object-cover" />
                </div>
              )}

              <div>
                <p className="text-xs text-[#B9B4D9]">Meal tags</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {MEAL_TAGS.map((tag) => {
                    const active = mealTags.includes(tag);
                    return (
                      <button key={tag} onClick={() => setMealTags((prev) => active ? prev.filter((v) => v !== tag) : [...prev, tag])} className={`rounded-full border px-2 py-0.5 text-[10px] ${active ? 'border-[#FF3EA566] bg-[#FF3EA522] text-[#F8F4FF]' : 'border-white/20 text-[#B9B4D9]'}`}>
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs text-[#B9B4D9]">PCOS tags</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {PCOS_TAGS.map((tag) => {
                    const active = pcosTags.includes(tag);
                    return (
                      <button key={tag} onClick={() => setPcosTags((prev) => active ? prev.filter((v) => v !== tag) : [...prev, tag])} className={`rounded-full border px-2 py-0.5 text-[10px] ${active ? 'border-[#FF3EA566] bg-[#FF3EA522] text-[#F8F4FF]' : 'border-white/20 text-[#B9B4D9]'}`}>
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <input value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="Protein" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-[#F8F4FF]" />
                <input value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="Carbs" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-[#F8F4FF]" />
                <input value={fat} onChange={(e) => setFat(e.target.value)} placeholder="Fat" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-[#F8F4FF]" />
              </div>

              <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs text-[#B9B4D9]">Ingredients per portion</p>
                  <button
                    onClick={() => setIngredientsRows((prev) => [...prev, { ingredient_name: '', qty_per_portion: '', unit: '' }])}
                    className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-[#F8F4FF]"
                  >
                    + Add
                  </button>
                </div>
                <div className="space-y-1.5">
                  {ingredientsRows.map((row, index) => (
                    <div key={`ingredient-${index}`} className="grid grid-cols-[1fr_90px_80px_auto] gap-1">
                      <input
                        value={row.ingredient_name}
                        onChange={(e) => setIngredientsRows((prev) => prev.map((item, i) => (i === index ? { ...item, ingredient_name: e.target.value } : item)))}
                        placeholder="Ingredient"
                        className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-[#F8F4FF]"
                      />
                      <input
                        value={row.qty_per_portion}
                        onChange={(e) => setIngredientsRows((prev) => prev.map((item, i) => (i === index ? { ...item, qty_per_portion: e.target.value } : item)))}
                        placeholder="Qty"
                        className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-[#F8F4FF]"
                      />
                      <input
                        value={row.unit}
                        onChange={(e) => setIngredientsRows((prev) => prev.map((item, i) => (i === index ? { ...item, unit: e.target.value } : item)))}
                        placeholder="Unit"
                        className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-[#F8F4FF]"
                      />
                      <button
                        onClick={() =>
                          setIngredientsRows((prev) => (prev.length === 1 ? [{ ingredient_name: '', qty_per_portion: '', unit: '' }] : prev.filter((_, i) => i !== index)))
                        }
                        className="rounded border border-white/20 px-2 py-1 text-[10px] text-[#B9B4D9]"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs text-[#B9B4D9]">Steps</p>
                  <button
                    onClick={() => setStepsRows((prev) => [...prev, { step_text: '' }])}
                    className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-[#F8F4FF]"
                  >
                    + Add
                  </button>
                </div>
                <div className="space-y-1.5">
                  {stepsRows.map((row, index) => (
                    <div key={`step-${index}`} className="grid grid-cols-[26px_1fr_auto] items-start gap-1">
                      <span className="pt-1 text-center text-[10px] text-[#B9B4D9]">{index + 1}</span>
                      <input
                        value={row.step_text}
                        onChange={(e) => setStepsRows((prev) => prev.map((item, i) => (i === index ? { step_text: e.target.value } : item)))}
                        placeholder="Step instruction"
                        className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-[#F8F4FF]"
                      />
                      <button
                        onClick={() => setStepsRows((prev) => (prev.length === 1 ? [{ step_text: '' }] : prev.filter((_, i) => i !== index)))}
                        className="rounded border border-white/20 px-2 py-1 text-[10px] text-[#B9B4D9]"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => void submitRecipe()} className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-4 py-1 text-xs text-[#F8F4FF]">{editingId ? 'Update' : 'Create'}</button>
                <button onClick={resetForm} className="rounded-full border border-white/20 px-4 py-1 text-xs text-[#F8F4FF]">Clear</button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {(activeBatches ?? []).map((batch) => (
            <div key={batch.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[11px] text-[#B9B4D9]">Cooked {new Date(batch.cooked_at).toLocaleString('en-GB')} • expires in {expiresInDays(batch.expires_at)}d</p>
              <div className="mt-2 space-y-1">
                {batch.recipes.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-2 py-1">
                    <p className="text-sm text-[#F8F4FF]">{r.recipe_title} • {r.portions_remaining} left</p>
                    <div className="flex gap-2">
                      <button onClick={() => onOpenMealLog(r.id)} className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-2 py-0.5 text-[10px] text-[#F8F4FF]">Log portion</button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={async () => {
                  await fetch(`/api/food/batches/${batch.id}/finish-meal`, { method: 'PATCH' });
                  await onRefresh();
                }}
                className="mt-2 rounded-full border border-white/20 px-3 py-1 text-xs text-[#F8F4FF]"
              >
                Finish meal
              </button>
            </div>
          ))}
          {activeBatches.length === 0 && <p className="text-sm text-[#B9B4D9]">No active cooked meals.</p>}
        </div>
      )}
    </BaseModal>
  );
}

function RecipeBookShortcutCard({ onOpen }: { onOpen: () => void }) {
  return (
    <section className={glassCard('min-h-0 h-full overflow-hidden p-2.5')}>
      <h2 className="font-serif text-xl text-[#F8F4FF]">Recipe Book</h2>
      <p className="mt-1 text-xs text-[#B9B4D9]">Manage recipes and view cooked meals.</p>
      <button onClick={onOpen} className="mt-3 rounded-full border border-[#C084FC66] bg-[#C084FC22] px-3 py-1 text-xs text-[#F8F4FF]">Open Recipe Book</button>
    </section>
  );
}

export function FoodWorld() {
  const [summary, setSummary] = useState<FoodSummary | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [plan, setPlan] = useState<PlanPayload | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  const [startFastOpen, setStartFastOpen] = useState(false);
  const [cookModeOpen, setCookModeOpen] = useState(false);
  const [mealLogOpen, setMealLogOpen] = useState(false);
  const [planWeekOpen, setPlanWeekOpen] = useState(false);
  const [groceryOpen, setGroceryOpen] = useState(false);
  const [recipeBookOpen, setRecipeBookOpen] = useState(false);
  const [prefillBatchRecipeId, setPrefillBatchRecipeId] = useState<number | null>(null);

  const loadAll = useCallback(async () => {
    const [summaryRes, recipesRes, planRes, inventoryRes] = await Promise.all([
      fetch('/api/food/summary', { cache: 'no-store' }),
      fetch('/api/food/recipes', { cache: 'no-store' }),
      fetch('/api/food/plan', { cache: 'no-store' }),
      fetch('/api/food/inventory', { cache: 'no-store' }),
    ]);
    if (summaryRes.ok) setSummary((await summaryRes.json()) as FoodSummary);
    if (recipesRes.ok) setRecipes((await recipesRes.json()) as Recipe[]);
    if (planRes.ok) setPlan((await planRes.json()) as PlanPayload);
    if (inventoryRes.ok) setInventory((await inventoryRes.json()) as InventoryItem[]);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  return (
    <BackgroundShell overlayClassName="bg-[radial-gradient(circle_at_50%_34%,rgba(255,62,165,0.16),rgba(192,132,252,0.08)_42%,rgba(8,6,24,0.82)_72%)]">
      <div className="mx-auto flex h-full w-full max-w-[1220px] flex-col gap-2 overflow-hidden px-5 pb-5 pt-2 md:px-8">
        <div className={glassCard('flex items-center justify-between px-4 py-2')}>
          <Link href="/" className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-[#B9B4D9]">← Back</Link>
          <div className="flex-1" />
          <div className="w-[84px]" />
        </div>

        <section className="grid flex-none place-items-center py-0.5">
          <div className="flex items-center justify-center gap-4 md:gap-5">
            <PortalBubble
              title="Fasting"
              subtitle={(summary?.fasting_status.state === 'FASTING' ? `Fasting: ${summary?.fasting_status.fast_type ?? 'session'}` : 'Not fasting') + ` • ${minutesText(summary?.fasting_status.minutes_to_next_state ?? null)}`}
              actionLabel={summary?.fasting_status.state === 'FASTING' ? 'End fast' : 'Start fast'}
              onAction={async () => {
                if (summary?.fasting_status.state === 'FASTING') {
                  await fetch('/api/food/fasting/end', { method: 'POST' });
                  await loadAll();
                  return;
                }
                setStartFastOpen(true);
              }}
              floatClass="float-a"
            />
            <PortalBubble title="Cook mode" subtitle="Cook something from your recipes" actionLabel="▶ Play" onAction={() => setCookModeOpen(true)} floatClass="float-b" />
            <PortalBubble
              title="Meal log"
              subtitle="Log cooked or cheat meal"
              actionLabel="Log"
              onAction={() => {
                setPrefillBatchRecipeId(null);
                setMealLogOpen(true);
              }}
              floatClass="float-a"
            />
          </div>
        </section>

        {/* 2x2 card grid under bubbles keeps cards proportionate and prevents overlap. */}
        <section className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-2 overflow-hidden">
          <PlannedMealsCard items={summary?.planned_upcoming ?? []} onOpenPlan={() => setPlanWeekOpen(true)} onOpenGrocery={() => setGroceryOpen(true)} />
          <MacroCard totals={summary?.today_macro_totals ?? null} chartRows={summary?.macros_7d ?? []} pcosAligned={summary?.pcos_aligned_count ?? 0} />
          <InventoryCard inventory={inventory} lowStock={summary?.low_stock_items ?? []} onRefresh={loadAll} />
          <RecipeBookShortcutCard onOpen={() => setRecipeBookOpen(true)} />
        </section>
      </div>

      <StartFastModal open={startFastOpen} onClose={() => setStartFastOpen(false)} onStarted={loadAll} />
      <CookModeModal open={cookModeOpen} recipes={recipes} inventory={inventory} onClose={() => setCookModeOpen(false)} onFinished={loadAll} />
      <MealLogModal open={mealLogOpen} batches={summary?.active_batches ?? []} fastingState={summary?.fasting_status.state ?? 'EATING WINDOW'} prefillBatchRecipeId={prefillBatchRecipeId} onClose={() => setMealLogOpen(false)} onSaved={loadAll} />
      <PlanWeekModal open={planWeekOpen} plan={plan} recipes={recipes} onClose={() => setPlanWeekOpen(false)} onSaved={loadAll} />
      <GroceryModal open={groceryOpen} items={summary?.grocery_pending ?? []} onClose={() => setGroceryOpen(false)} onRefresh={loadAll} />
      <RecipeBookModal
        open={recipeBookOpen}
        recipes={recipes}
        activeBatches={summary?.active_batches ?? []}
        onClose={() => setRecipeBookOpen(false)}
        onRefresh={loadAll}
        onOpenMealLog={(batchRecipeId) => {
          setRecipeBookOpen(false);
          setPrefillBatchRecipeId(batchRecipeId ?? null);
          setMealLogOpen(true);
        }}
      />
    </BackgroundShell>
  );
}
