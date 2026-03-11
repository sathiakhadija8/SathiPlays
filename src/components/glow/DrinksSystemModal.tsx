'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePlatformWindowOpen } from '../../lib/use-platform-window-open';

type DrinkCategory = 'seed_water' | 'beauty_drink';
type TimeOfDay = 'morning' | 'midday' | 'evening' | 'night';

type SeedWaterItem = {
  id: number;
  name: string;
  seed_types: string[];
  recipe: string | null;
  time_of_day: TimeOfDay;
  is_active: number;
};

type BeautyDrinkItem = {
  id: number;
  name: string;
  recipe: string | null;
  icon_image_path: string | null;
  time_of_day: TimeOfDay;
  is_active: number;
};

type SystemResponse = {
  seed_waters: SeedWaterItem[];
  beauty_drink_recipes: BeautyDrinkItem[];
};

type DrinkDraft = {
  category: DrinkCategory;
  name: string;
  seed_types_text: string;
  recipe: string;
  time_of_day: TimeOfDay;
  is_active: 0 | 1;
};

const EMPTY_DRAFT: DrinkDraft = {
  category: 'seed_water',
  name: '',
  seed_types_text: '',
  recipe: '',
  time_of_day: 'morning',
  is_active: 1,
};

function seedTypesToText(seedTypes: string[] | undefined) {
  if (!Array.isArray(seedTypes) || seedTypes.length === 0) return '';
  return seedTypes.join(', ');
}

function toDraft(item: SeedWaterItem | BeautyDrinkItem, category: DrinkCategory): DrinkDraft {
  return {
    category,
    name: item.name,
    seed_types_text: category === 'seed_water' ? seedTypesToText((item as SeedWaterItem).seed_types) : '',
    recipe: item.recipe ?? '',
    time_of_day: item.time_of_day,
    is_active: Number(item.is_active) === 1 ? 1 : 0,
  };
}

function buildPayload(draft: DrinkDraft) {
  return {
    category: draft.category,
    name: draft.name.trim(),
    seed_types:
      draft.category === 'seed_water'
        ? draft.seed_types_text
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean)
        : [],
    recipe: draft.recipe.trim() || null,
    time_of_day: draft.time_of_day,
    is_active: draft.is_active,
  };
}

export function DrinksSystemModal({
  open,
  onClose,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const [mounted, setMounted] = useState(false);
  const [seedWaters, setSeedWaters] = useState<SeedWaterItem[]>([]);
  const [beautyRecipes, setBeautyRecipes] = useState<BeautyDrinkItem[]>([]);
  const [newItem, setNewItem] = useState<DrinkDraft>(EMPTY_DRAFT);
  const [drafts, setDrafts] = useState<Record<string, DrinkDraft>>({});
  const [savingNew, setSavingNew] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  usePlatformWindowOpen(open);
  useEffect(() => setMounted(true), []);

  const loadSystem = async () => {
    setError(null);
    const response = await fetch('/api/glow/drinks/system', { cache: 'no-store' });
    if (!response.ok) {
      setSeedWaters([]);
      setBeautyRecipes([]);
      return;
    }

    const payload = (await response.json()) as SystemResponse;
    const nextSeed = Array.isArray(payload.seed_waters) ? payload.seed_waters : [];
    const nextBeauty = Array.isArray(payload.beauty_drink_recipes) ? payload.beauty_drink_recipes : [];

    setSeedWaters(nextSeed);
    setBeautyRecipes(nextBeauty);

    const nextDrafts: Record<string, DrinkDraft> = {};
    for (const item of nextSeed) nextDrafts[`seed_water:${item.id}`] = toDraft(item, 'seed_water');
    for (const item of nextBeauty) nextDrafts[`beauty_drink:${item.id}`] = toDraft(item, 'beauty_drink');
    setDrafts(nextDrafts);
  };

  useEffect(() => {
    if (!open) return;
    void loadSystem();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitNew = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!newItem.name.trim()) {
      setError('Name is required.');
      return;
    }
    setSavingNew(true);
    const response = await fetch('/api/glow/drinks/system/drink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(newItem)),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setError(payload.message ?? 'Unable to create drink.');
      setSavingNew(false);
      return;
    }

    setNewItem(EMPTY_DRAFT);
    await loadSystem();
    await onUpdated();
    setSavingNew(false);
  };

  const saveItem = async (key: string, id: number) => {
    const draft = drafts[key];
    if (!draft) return;
    setError(null);

    if (!draft.name.trim()) {
      setError('Name is required.');
      return;
    }

    setSavingKey(key);
    const response = await fetch(`/api/glow/drinks/system/drink/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(draft)),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setError(payload.message ?? 'Unable to save drink.');
      setSavingKey(null);
      return;
    }

    await loadSystem();
    await onUpdated();
    setSavingKey(null);
  };

  const removeItem = async (category: DrinkCategory, id: number) => {
    const key = `${category}:${id}`;
    setDeletingKey(key);
    await fetch(`/api/glow/drinks/system/drink/${id}?category=${category}`, { method: 'DELETE' });
    await loadSystem();
    await onUpdated();
    setDeletingKey(null);
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-3 backdrop-blur-sm">
      <div className="flex h-[min(86vh,800px)] w-full max-w-[1024px] flex-col rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.62)] p-3 backdrop-blur-xl">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="font-serif text-xl text-[#F8F4FF]">Drinks System</h3>
          <button type="button" onClick={onClose} className="rounded-full border border-white/20 px-3 py-1 text-xs text-[#F8F4FF]">
            Close
          </button>
        </div>

        <form className="mb-3 rounded-2xl border border-white/10 bg-black/20 p-2.5" onSubmit={submitNew}>
          <div className="mb-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setNewItem((prev) => ({ ...prev, category: 'seed_water' }))}
              className={`rounded-full border px-3 py-1 text-[11px] ${
                newItem.category === 'seed_water'
                  ? 'border-[#69b9ff66] bg-[#3ca0ff33] text-white'
                  : 'border-white/20 bg-transparent text-[#D7D3F1]'
              }`}
            >
              Seed Water
            </button>
            <button
              type="button"
              onClick={() => setNewItem((prev) => ({ ...prev, category: 'beauty_drink', seed_types_text: '' }))}
              className={`rounded-full border px-3 py-1 text-[11px] ${
                newItem.category === 'beauty_drink'
                  ? 'border-[#f597ff66] bg-[#f26dff33] text-white'
                  : 'border-white/20 bg-transparent text-[#D7D3F1]'
              }`}
            >
              Beauty Drink
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <input
              value={newItem.name}
              onChange={(event) => setNewItem((prev) => ({ ...prev, name: event.target.value }))}
              placeholder={newItem.category === 'seed_water' ? 'Seed water name' : 'Beauty drink name'}
              className="h-9 rounded-xl border border-white/10 bg-black/20 px-3 text-xs text-[#F8F4FF]"
            />

            <select
              value={newItem.time_of_day}
              onChange={(event) => setNewItem((prev) => ({ ...prev, time_of_day: event.target.value as TimeOfDay }))}
              className="h-9 rounded-xl border border-white/10 bg-black/20 px-3 text-xs text-[#F8F4FF]"
            >
              <option value="morning">Morning</option>
              <option value="midday">Midday</option>
              <option value="evening">Evening</option>
              <option value="night">Night</option>
            </select>

            <button
              type="button"
              onClick={() => setNewItem((prev) => ({ ...prev, is_active: prev.is_active === 1 ? 0 : 1 }))}
              className={`h-9 rounded-xl border text-xs ${
                newItem.is_active === 1
                  ? 'border-[#4bdca466] bg-[#4bdca422] text-[#d8ffe9]'
                  : 'border-white/20 bg-transparent text-[#D7D3F1]'
              }`}
            >
              {newItem.is_active === 1 ? 'Active' : 'Inactive'}
            </button>

            {newItem.category === 'seed_water' ? (
              <input
                value={newItem.seed_types_text}
                onChange={(event) => setNewItem((prev) => ({ ...prev, seed_types_text: event.target.value }))}
                placeholder="Seed types (chia, flax, basil)"
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-[#F8F4FF] md:col-span-3"
              />
            ) : null}

            <textarea
              rows={2}
              value={newItem.recipe}
              onChange={(event) => setNewItem((prev) => ({ ...prev, recipe: event.target.value }))}
              placeholder="Recipe: ingredients + steps"
              className="md:col-span-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-[#F8F4FF]"
            />
          </div>

          <div className="mt-2 flex items-center justify-end">
            <button
              type="submit"
              disabled={savingNew}
              className="h-9 rounded-xl border border-[#FF3EA566] bg-[#FF3EA522] px-4 text-xs text-[#F8F4FF]"
            >
              {savingNew ? 'Saving...' : 'Add Drink'}
            </button>
          </div>
        </form>

        {error && <p className="mb-2 font-sans text-xs text-[#ff9acb]">{error}</p>}

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="space-y-3">
            <section className="rounded-2xl border border-[#69b9ff4d] bg-[#3ca0ff12] p-2.5">
              <p className="mb-2 font-sans text-[11px] uppercase tracking-[0.16em] text-[#cae8ff]">Seed Water</p>
              <div className="space-y-2">
                {seedWaters.map((item) => {
                  const key = `seed_water:${item.id}`;
                  const draft = drafts[key] ?? toDraft(item, 'seed_water');
                  return (
                    <div key={key} className="rounded-xl border border-[#69b9ff36] bg-black/20 p-2">
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        <input
                          value={draft.name}
                          onChange={(event) => setDrafts((prev) => ({ ...prev, [key]: { ...draft, name: event.target.value } }))}
                          className="h-9 rounded-xl border border-white/10 bg-black/25 px-3 text-xs text-[#F8F4FF]"
                        />
                        <select
                          value={draft.time_of_day}
                          onChange={(event) => setDrafts((prev) => ({ ...prev, [key]: { ...draft, time_of_day: event.target.value as TimeOfDay } }))}
                          className="h-9 rounded-xl border border-white/10 bg-black/25 px-3 text-xs text-[#F8F4FF]"
                        >
                          <option value="morning">Morning</option>
                          <option value="midday">Midday</option>
                          <option value="evening">Evening</option>
                          <option value="night">Night</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setDrafts((prev) => ({ ...prev, [key]: { ...draft, is_active: draft.is_active === 1 ? 0 : 1 } }))
                          }
                          className={`h-9 rounded-xl border text-xs ${
                            draft.is_active === 1
                              ? 'border-[#4bdca466] bg-[#4bdca422] text-[#d8ffe9]'
                              : 'border-white/20 bg-transparent text-[#D7D3F1]'
                          }`}
                        >
                          {draft.is_active === 1 ? 'Active' : 'Inactive'}
                        </button>
                        <input
                          value={draft.seed_types_text}
                          onChange={(event) => setDrafts((prev) => ({ ...prev, [key]: { ...draft, seed_types_text: event.target.value } }))}
                          placeholder="Seed types (comma separated)"
                          className="md:col-span-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-[#F8F4FF]"
                        />
                        <textarea
                          rows={2}
                          value={draft.recipe}
                          onChange={(event) => setDrafts((prev) => ({ ...prev, [key]: { ...draft, recipe: event.target.value } }))}
                          className="md:col-span-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-[#F8F4FF]"
                        />
                      </div>

                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void saveItem(key, item.id)}
                          disabled={savingKey === key}
                          className="rounded-full border border-[#69b9ff66] bg-[#3ca0ff33] px-3 py-1 text-xs text-white"
                        >
                          {savingKey === key ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeItem('seed_water', item.id)}
                          disabled={deletingKey === key}
                          className="rounded-full border border-white/20 px-3 py-1 text-xs text-[#ff9acb]"
                        >
                          {deletingKey === key ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {seedWaters.length === 0 && <p className="font-sans text-xs text-[#B9B4D9]">No seed water configured.</p>}
              </div>
            </section>

            <section className="rounded-2xl border border-[#f597ff4d] bg-[#f26dff12] p-2.5">
              <p className="mb-2 font-sans text-[11px] uppercase tracking-[0.16em] text-[#ffe1ff]">Beauty Drink Recipes</p>
              <div className="space-y-2">
                {beautyRecipes.map((item) => {
                  const key = `beauty_drink:${item.id}`;
                  const draft = drafts[key] ?? toDraft(item, 'beauty_drink');
                  return (
                    <div key={key} className="rounded-xl border border-[#f597ff36] bg-black/20 p-2">
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        <input
                          value={draft.name}
                          onChange={(event) => setDrafts((prev) => ({ ...prev, [key]: { ...draft, name: event.target.value } }))}
                          className="h-9 rounded-xl border border-white/10 bg-black/25 px-3 text-xs text-[#F8F4FF]"
                        />
                        <select
                          value={draft.time_of_day}
                          onChange={(event) => setDrafts((prev) => ({ ...prev, [key]: { ...draft, time_of_day: event.target.value as TimeOfDay } }))}
                          className="h-9 rounded-xl border border-white/10 bg-black/25 px-3 text-xs text-[#F8F4FF]"
                        >
                          <option value="morning">Morning</option>
                          <option value="midday">Midday</option>
                          <option value="evening">Evening</option>
                          <option value="night">Night</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setDrafts((prev) => ({ ...prev, [key]: { ...draft, is_active: draft.is_active === 1 ? 0 : 1 } }))
                          }
                          className={`h-9 rounded-xl border text-xs ${
                            draft.is_active === 1
                              ? 'border-[#4bdca466] bg-[#4bdca422] text-[#d8ffe9]'
                              : 'border-white/20 bg-transparent text-[#D7D3F1]'
                          }`}
                        >
                          {draft.is_active === 1 ? 'Active' : 'Inactive'}
                        </button>
                        <textarea
                          rows={2}
                          value={draft.recipe}
                          onChange={(event) => setDrafts((prev) => ({ ...prev, [key]: { ...draft, recipe: event.target.value } }))}
                          className="md:col-span-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-[#F8F4FF]"
                        />
                      </div>

                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void saveItem(key, item.id)}
                          disabled={savingKey === key}
                          className="rounded-full border border-[#f597ff66] bg-[#f26dff33] px-3 py-1 text-xs text-white"
                        >
                          {savingKey === key ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeItem('beauty_drink', item.id)}
                          disabled={deletingKey === key}
                          className="rounded-full border border-white/20 px-3 py-1 text-xs text-[#ff9acb]"
                        >
                          {deletingKey === key ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {beautyRecipes.length === 0 && <p className="font-sans text-xs text-[#B9B4D9]">No beauty drink recipes configured.</p>}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
