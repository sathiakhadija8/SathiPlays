'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePlatformWindowOpen } from '../../lib/use-platform-window-open';

type PortalKey = 'closet' | 'laundry' | 'outfit' | null;
type ClosetState = 'in_closet' | 'dirty';
type OutfitSlotType = 'headwear' | 'outerwear' | 'top' | 'bottom' | 'dress' | 'shoes' | 'bag' | 'accessory';

type ClosetItem = {
  id: number;
  name: string;
  category: string | null;
  subcategory: string | null;
  size: string | null;
  color: string | null;
  brand: string | null;
  season: string | null;
  occasion: string | null;
  image_path: string | null;
  notes: string | null;
  state: ClosetState;
  is_favorite: number;
  is_archived: number;
  wear_count: number;
  last_worn_at: string | null;
};

type Outfit = {
  id: number;
  name: string;
  vibe: string | null;
  occasion: string | null;
  season: string | null;
  notes: string | null;
  preview_image_path: string | null;
  items: Array<{
    id: number;
    closet_item_id: number;
    slot_type: OutfitSlotType;
    sort_order: number;
    name: string;
    image_path: string | null;
  }>;
};

const SLOT_ORDER: OutfitSlotType[] = ['headwear', 'outerwear', 'top', 'dress', 'bottom', 'shoes', 'bag', 'accessory'];
const PREVIEW_SLOT_ORDER: OutfitSlotType[] = ['headwear', 'outerwear', 'top', 'dress', 'bottom', 'shoes', 'bag', 'accessory'];
const CATEGORY_SUBCATEGORY_MAP: Record<string, string[]> = {
  Tops: ['T-Shirt', 'Shirt', 'Blouse', 'Sweater', 'Hoodie', 'Cardigan', 'Tunic'],
  Bottoms: ['Jeans', 'Trousers', 'Skirt', 'Shorts', 'Leggings'],
  Dresses: ['Casual Dress', 'Formal Dress', 'Abaya', 'Jumpsuit'],
  Outerwear: ['Jacket', 'Coat', 'Blazer', 'Kimono', 'Cape'],
  Shoes: ['Sneakers', 'Heels', 'Flats', 'Boots', 'Sandals', 'Slippers'],
  Bags: ['Handbag', 'Crossbody', 'Backpack', 'Tote', 'Clutch'],
  Accessories: ['Hijab', 'Scarf', 'Belt', 'Jewelry', 'Hat', 'Gloves'],
};
const DEFAULT_SEASONS = ['All Season', 'Spring', 'Summer', 'Autumn', 'Winter'] as const;
const DEFAULT_OCCASIONS = ['Casual', 'Work', 'Formal', 'Party', 'Travel', 'Gym', 'Home', 'Prayer'] as const;

function StickerPortal({ src, label, onClick }: { src: string; label: string; onClick: () => void }) {
  const srcOptions = useMemo(() => {
    const options = [src];
    if (src.startsWith('/Images/')) {
      options.push(src.replace('/Images/', '/SathiPlays/Images/'));
    } else if (src.startsWith('/SathiPlays/Images/')) {
      options.push(src.replace('/SathiPlays/Images/', '/Images/'));
    }
    return Array.from(new Set(options));
  }, [src]);
  const [srcIndex, setSrcIndex] = useState(0);
  const [errored, setErrored] = useState(false);
  return (
    <button
      onClick={onClick}
      className="group flex w-full max-w-[220px] flex-col items-center rounded-3xl border border-[#ffffff26] bg-[rgba(20,18,40,0.55)] p-4 transition-all hover:-translate-y-1 hover:bg-[rgba(38,33,71,0.72)]"
    >
      {errored ? (
        <div className="grid h-32 w-32 place-items-center rounded-full border border-[#ffffff3a] bg-[rgba(255,255,255,0.05)] text-4xl">✨</div>
      ) : (
        <img
          src={srcOptions[srcIndex]}
          alt={label}
          className="h-32 w-32 object-contain"
          onError={() => {
            const next = srcIndex + 1;
            if (next < srcOptions.length) {
              setSrcIndex(next);
              return;
            }
            setErrored(true);
          }}
        />
      )}
      <span className="mt-3 font-serif text-xl text-[#F7F5FF]">{label}</span>
      <span className="text-xs text-[#BFB8E6]">Open Portal</span>
    </button>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-[120] grid place-items-center bg-[rgba(7,8,20,0.68)] p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <section
        className="h-[min(88vh,820px)] w-[min(96vw,1180px)] overflow-hidden rounded-3xl border border-[#ffffff2b] bg-[linear-gradient(180deg,rgba(19,17,40,0.96),rgba(12,10,30,0.94))]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-[#ffffff22] px-6 py-4">
          <h3 className="font-serif text-3xl text-[#F7F5FF]">{title}</h3>
          <button onClick={onClose} className="rounded-full border border-[#ffffff33] px-3 py-1 text-xs text-[#F7F5FF]">Close</button>
        </header>
        <div className="h-[calc(100%-74px)] overflow-auto p-6">{children}</div>
      </section>
    </div>,
    document.body,
  );
}

export function ClosetPortals() {
  const [openPortal, setOpenPortal] = useState<PortalKey>(null);
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [seasonFilter, setSeasonFilter] = useState('');
  const [occasionFilter, setOccasionFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [subcategoryFilter, setSubcategoryFilter] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [selectedDirtyIds, setSelectedDirtyIds] = useState<number[]>([]);
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    category: '',
    subcategory: '',
    color: '',
    brand: '',
    season: '',
    occasion: '',
    notes: '',
    image_path: '',
  });
  const [newItemSeasons, setNewItemSeasons] = useState<string[]>([]);
  const [newItemOccasions, setNewItemOccasions] = useState<string[]>([]);
  const [newItemFile, setNewItemFile] = useState<File | null>(null);
  const [activeSlot, setActiveSlot] = useState<OutfitSlotType>('top');
  const [slotMap, setSlotMap] = useState<Record<OutfitSlotType, ClosetItem | null>>({
    headwear: null,
    outerwear: null,
    top: null,
    bottom: null,
    dress: null,
    shoes: null,
    bag: null,
    accessory: null,
  });
  const [outfitName, setOutfitName] = useState('');
  const [outfitVibe, setOutfitVibe] = useState('');

  usePlatformWindowOpen(openPortal !== null);

  const loadCloset = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/home/closet?include_archived=1', { cache: 'no-store' });
      const payload = await response.json();
      setItems(Array.isArray(payload.items) ? payload.items : []);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOutfits = useCallback(async () => {
    const response = await fetch('/api/home/closet/outfits', { cache: 'no-store' });
    const payload = await response.json();
    setOutfits(Array.isArray(payload) ? payload : []);
  }, []);

  useEffect(() => {
    if (!openPortal) return;
    void loadCloset();
    if (openPortal === 'outfit') void loadOutfits();
  }, [openPortal, loadCloset, loadOutfits]);

  const filteredClosetItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const queryOk =
        !q ||
        `${item.name} ${item.category ?? ''} ${item.subcategory ?? ''} ${item.brand ?? ''} ${item.color ?? ''}`
          .toLowerCase()
          .includes(q);
      const seasonValues = (item.season ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      const seasonOk = !seasonFilter || seasonValues.includes(seasonFilter) || seasonValues.includes('All Season');
      const occasionValues = (item.occasion ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      const occasionOk = !occasionFilter || occasionValues.includes(occasionFilter);
      const categoryOk = !categoryFilter || (item.category ?? '') === categoryFilter;
      const subcategoryOk = !subcategoryFilter || (item.subcategory ?? '') === subcategoryFilter;
      return queryOk && seasonOk && occasionOk && categoryOk && subcategoryOk;
    });
  }, [items, query, seasonFilter, occasionFilter, categoryFilter, subcategoryFilter]);

  const categoryOptions = useMemo(() => {
    const fromMap = Object.keys(CATEGORY_SUBCATEGORY_MAP);
    const fromItems = items.map((item) => (item.category ?? '').trim()).filter(Boolean);
    return Array.from(new Set([...fromMap, ...fromItems])).sort();
  }, [items]);

  const subcategoryOptions = useMemo(() => {
    if (categoryFilter) {
      const fromMap = CATEGORY_SUBCATEGORY_MAP[categoryFilter] ?? [];
      const fromItems = items
        .filter((item) => (item.category ?? '') === categoryFilter)
        .map((item) => (item.subcategory ?? '').trim())
        .filter(Boolean);
      return Array.from(new Set([...fromMap, ...fromItems])).sort();
    }
    const fromMap = Object.values(CATEGORY_SUBCATEGORY_MAP).flat();
    const fromItems = items.map((item) => (item.subcategory ?? '').trim()).filter(Boolean);
    return Array.from(new Set([...fromMap, ...fromItems])).sort();
  }, [items, categoryFilter]);

  const seasonOptions = useMemo(() => {
    const fromItems = items
      .flatMap((item) => (item.season ?? '').split(','))
      .map((value) => value.trim())
      .filter(Boolean);
    return Array.from(new Set([...DEFAULT_SEASONS, ...fromItems])).sort();
  }, [items]);

  const occasionOptions = useMemo(() => {
    const fromItems = items
      .flatMap((item) => (item.occasion ?? '').split(','))
      .map((value) => value.trim())
      .filter(Boolean);
    return Array.from(new Set([...DEFAULT_OCCASIONS, ...fromItems])).sort();
  }, [items]);

  const newItemSubcategoryOptions = useMemo(() => {
    if (!newItem.category) return [];
    const fromMap = CATEGORY_SUBCATEGORY_MAP[newItem.category] ?? [];
    const fromItems = items
      .filter((item) => (item.category ?? '') === newItem.category)
      .map((item) => (item.subcategory ?? '').trim())
      .filter(Boolean);
    return Array.from(new Set([...fromMap, ...fromItems])).sort();
  }, [items, newItem.category]);

  const readyItems = useMemo(
    () => items.filter((item) => item.state === 'in_closet' && Number(item.is_archived) !== 1),
    [items],
  );
  const dirtyItems = useMemo(() => items.filter((item) => item.state === 'dirty' && Number(item.is_archived) !== 1), [items]);

  const createClosetItem = async () => {
    if (!newItem.name.trim()) return;
    let imagePath = newItem.image_path;
    if (newItemFile) {
      const formData = new FormData();
      formData.append('file', newItemFile);
      const uploadResponse = await fetch('/api/home/closet/upload-image', { method: 'POST', body: formData });
      const uploadPayload = (await uploadResponse.json()) as { image_path?: string };
      if (typeof uploadPayload.image_path === 'string') {
        imagePath = uploadPayload.image_path;
      }
    }
    await fetch('/api/home/closet/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newItem,
        season: newItemSeasons.length > 0 ? newItemSeasons.join(', ') : null,
        occasion: newItemOccasions.length > 0 ? newItemOccasions.join(', ') : null,
        image_path: imagePath || null,
      }),
    });
    setNewItem({
      name: '', category: '', subcategory: '', color: '', brand: '', season: '', occasion: '', notes: '', image_path: '',
    });
    setNewItemSeasons([]);
    setNewItemOccasions([]);
    setNewItemFile(null);
    await loadCloset();
  };

  const updateItem = async (id: number, patch: Record<string, unknown>) => {
    await fetch(`/api/home/closet/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    await loadCloset();
  };

  const moveToLaundry = async (id: number) => {
    await fetch(`/api/home/closet/${id}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'dirty', notes: 'Sent to laundry' }),
    });
    await loadCloset();
  };

  const setItemState = async (id: number, state: ClosetState) => {
    await fetch(`/api/home/closet/${id}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state }),
    });
    await loadCloset();
  };

  const editItem = async (item: ClosetItem) => {
    const nextName = window.prompt('Edit item name', item.name);
    if (nextName === null) return;
    const nextCategory = window.prompt('Edit category', item.category ?? '');
    if (nextCategory === null) return;
    await updateItem(item.id, { name: nextName, category: nextCategory || null });
  };

  const washSelected = async () => {
    if (selectedDirtyIds.length === 0) return;
    await fetch('/api/home/closet/bulk-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_ids: selectedDirtyIds, to_state: 'in_closet' }),
    });
    setSelectedDirtyIds([]);
    await loadCloset();
  };

  const assignToSlot = (item: ClosetItem) => {
    setSlotMap((prev) => ({ ...prev, [activeSlot]: item }));
  };

  const saveOutfit = async () => {
    if (!outfitName.trim()) return;
    const itemsPayload = SLOT_ORDER.flatMap((slot, idx) => {
      const item = slotMap[slot];
      return item ? [{ closet_item_id: item.id, slot_type: slot, sort_order: idx }] : [];
    });

    await fetch('/api/home/closet/outfits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: outfitName.trim(),
        vibe: outfitVibe.trim() || null,
        items: itemsPayload,
      }),
    });

    setOutfitName('');
    setOutfitVibe('');
    setSlotMap({ headwear: null, outerwear: null, top: null, bottom: null, dress: null, shoes: null, bag: null, accessory: null });
    await loadOutfits();
  };

  const previewSlots = useMemo(() => {
    const hasDress = Boolean(slotMap.dress);
    return PREVIEW_SLOT_ORDER.filter((slot) => {
      if (!hasDress) return true;
      return slot !== 'top' && slot !== 'bottom';
    });
  }, [slotMap]);

  return (
    <>
      <div className="grid w-full max-w-[760px] grid-cols-1 gap-4 sm:grid-cols-3">
        <StickerPortal src="/Images/clothesSticker.png?v=20260311c" label="Closet" onClick={() => setOpenPortal('closet')} />
        <StickerPortal src="/Images/laundry.png?v=20260311c" label="Laundry" onClick={() => setOpenPortal('laundry')} />
        <StickerPortal src="/Images/outfitPlanner.png?v=20260311c" label="Outfit Planner" onClick={() => setOpenPortal('outfit')} />
      </div>

      {openPortal === 'closet' && (
        <ModalShell title="Wardrobe Inventory" onClose={() => setOpenPortal(null)}>
          <div className="mb-4 flex items-center justify-end gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search wardrobe"
              className="w-full max-w-[280px] rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm"
            />
            <button
              onClick={() => setShowFilterPanel((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Filters
            </button>
          </div>

          {showFilterPanel ? (
            <div className="mb-4 grid grid-cols-1 gap-2 rounded-2xl border border-white/15 bg-white/5 p-3 md:grid-cols-5">
              <select value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)} className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm">
                <option value="">All Seasons</option>
                {seasonOptions.map((season) => <option key={season} value={season}>{season}</option>)}
              </select>
              <select value={occasionFilter} onChange={(e) => setOccasionFilter(e.target.value)} className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm">
                <option value="">All Occasions</option>
                {occasionOptions.map((occasion) => <option key={occasion} value={occasion}>{occasion}</option>)}
              </select>
              <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setSubcategoryFilter(''); }} className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm">
                <option value="">All Categories</option>
                {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              <select value={subcategoryFilter} onChange={(e) => setSubcategoryFilter(e.target.value)} className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm">
                <option value="">All Subcategories</option>
                {subcategoryOptions.map((subcategory) => <option key={subcategory} value={subcategory}>{subcategory}</option>)}
              </select>
              <button onClick={() => { setQuery(''); setSeasonFilter(''); setOccasionFilter(''); setCategoryFilter(''); setSubcategoryFilter(''); }} className="rounded-xl border border-white/20 px-3 py-2 text-xs">Clear</button>
            </div>
          ) : null}

          <div className="mb-3 flex items-center justify-end">
            <button
              onClick={() => setShowAddItemForm((prev) => !prev)}
              className="rounded-full border border-[#89c0ff66] bg-[#89c0ff22] px-3 py-1.5 text-xs"
            >
              {showAddItemForm ? 'Close Add Item' : 'Add Item'}
            </button>
          </div>

          {showAddItemForm ? (
            <div className="mb-6 grid grid-cols-1 gap-2 md:grid-cols-8">
              <input value={newItem.name} onChange={(e) => setNewItem((p) => ({ ...p, name: e.target.value }))} placeholder="Name" className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm" />
              <select
                value={newItem.category}
                onChange={(e) => setNewItem((p) => ({ ...p, category: e.target.value, subcategory: '' }))}
                className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm"
              >
                <option value="">Choose Category</option>
                {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              <select
                value={newItem.subcategory}
                onChange={(e) => setNewItem((p) => ({ ...p, subcategory: e.target.value }))}
                className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm"
                disabled={!newItem.category}
              >
                <option value="">Choose Subcategory</option>
                {newItemSubcategoryOptions.map((subcategory) => <option key={subcategory} value={subcategory}>{subcategory}</option>)}
              </select>
              <div className="rounded-xl border border-white/20 bg-white/5 px-3 py-2">
                <p className="mb-2 text-[11px] uppercase tracking-wide text-[#c5b6ef]">Choose Season(s)</p>
                <div className="flex flex-wrap gap-2">
                  {seasonOptions.map((season) => {
                    const active = newItemSeasons.includes(season);
                    return (
                      <button
                        key={season}
                        type="button"
                        onClick={() =>
                          setNewItemSeasons((prev) =>
                            prev.includes(season) ? prev.filter((value) => value !== season) : [...prev, season],
                          )
                        }
                        className={`rounded-full border px-2 py-1 text-[11px] ${active ? 'border-[#9fd0ff88] bg-[#9fd0ff24]' : 'border-white/25'}`}
                      >
                        {season}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/5 px-3 py-2">
                <p className="mb-2 text-[11px] uppercase tracking-wide text-[#c5b6ef]">Choose Occasion(s)</p>
                <div className="flex flex-wrap gap-2">
                  {occasionOptions.map((occasion) => {
                    const active = newItemOccasions.includes(occasion);
                    return (
                      <button
                        key={occasion}
                        type="button"
                        onClick={() =>
                          setNewItemOccasions((prev) =>
                            prev.includes(occasion) ? prev.filter((value) => value !== occasion) : [...prev, occasion],
                          )
                        }
                        className={`rounded-full border px-2 py-1 text-[11px] ${active ? 'border-[#ffcea088] bg-[#ffcea024]' : 'border-white/25'}`}
                      >
                        {occasion}
                      </button>
                    );
                  })}
                </div>
              </div>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setNewItemFile(e.target.files?.[0] ?? null)} className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs" />
              <button onClick={() => void createClosetItem()} className="rounded-xl border border-[#89c0ff66] bg-[#89c0ff22] px-3 py-2 text-xs">Add Piece</button>
            </div>
          ) : null}

          {loading ? <p className="text-sm text-[#C8C1E8]">Loading inventory...</p> : null}
          <div className="grid w-full grid-cols-2 justify-items-center gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 min-[1440px]:grid-cols-6 min-[1720px]:grid-cols-7">
            {filteredClosetItems.map((item) => (
              <article key={item.id} className="h-[300px] w-[200px] overflow-hidden rounded-2xl border border-white/15 bg-white/5">
                <div className="flex h-[220px] w-[200px] items-center justify-center bg-[rgba(255,255,255,0.03)] p-2">
                  <img src={item.image_path || '/Images/background.png'} alt={item.name} className="h-full w-full object-contain" />
                </div>
                <div className="h-[80px] space-y-1 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-[#F6F2FF]">{item.name}</p>
                    <button onClick={() => void updateItem(item.id, { is_favorite: Number(item.is_favorite) === 1 ? 0 : 1 })} className="text-sm">
                      {Number(item.is_favorite) === 1 ? '★' : '☆'}
                    </button>
                  </div>
                  <p className="truncate text-[11px] text-[#C8C1E8]">{item.category || 'Uncategorized'} {item.subcategory ? `• ${item.subcategory}` : ''}</p>
                  <div className="flex items-center justify-between">
                    <p className="truncate text-[11px] text-[#AFA7D8]">{item.size || 'No size'}</p>
                    <select
                      value={item.state}
                      onChange={(event) => void setItemState(item.id, event.target.value as ClosetState)}
                      className="rounded-full border border-white/25 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#c4b8ff]"
                    >
                      <option value="in_closet">in_closet</option>
                      <option value="dirty">dirty</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-center gap-1 border-t border-white/10 px-2 py-1.5">
                  <button onClick={() => void editItem(item)} className="rounded-full border border-white/25 px-2 py-0.5 text-[10px]">Edit</button>
                  <button onClick={() => void updateItem(item.id, { is_archived: Number(item.is_archived) === 1 ? 0 : 1 })} className="rounded-full border border-white/25 px-2 py-0.5 text-[10px]">{Number(item.is_archived) === 1 ? 'Unarchive' : 'Archive'}</button>
                  {item.state === 'in_closet' ? (
                    <button onClick={() => void moveToLaundry(item.id)} className="rounded-full border border-[#ff9db766] bg-[#ff9db722] px-2 py-0.5 text-[10px]">Laundry</button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </ModalShell>
      )}

      {openPortal === 'laundry' && (
        <ModalShell title="Laundry Reset" onClose={() => setOpenPortal(null)}>
          <div className="mb-3 flex gap-2">
            <button onClick={() => setSelectedDirtyIds(dirtyItems.map((item) => item.id))} className="rounded-full border border-white/25 px-3 py-1 text-xs">Select all</button>
            <button onClick={() => setSelectedDirtyIds([])} className="rounded-full border border-white/25 px-3 py-1 text-xs">Clear</button>
            <button onClick={() => void washSelected()} className="rounded-full border border-[#8cffb866] bg-[#8cffb822] px-3 py-1 text-xs">Mark washed → In Closet</button>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {dirtyItems.map((item) => (
              <label key={item.id} className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 p-3">
                <input
                  type="checkbox"
                  checked={selectedDirtyIds.includes(item.id)}
                  onChange={(e) => setSelectedDirtyIds((prev) => (e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id)))}
                />
                <img src={item.image_path || '/Images/background.png'} alt={item.name} className="h-16 w-12 rounded-lg object-cover" />
                <div>
                  <p className="text-sm text-[#F6F2FF]">{item.name}</p>
                  <p className="text-xs text-[#C8C1E8]">{item.category || 'Uncategorized'}</p>
                </div>
              </label>
            ))}
            {dirtyItems.length === 0 ? <p className="text-sm text-[#BFB8E6]">No dirty items. Laundry is clear.</p> : null}
          </div>
        </ModalShell>
      )}

      {openPortal === 'outfit' && (
        <ModalShell title="Outfit Planner" onClose={() => setOpenPortal(null)}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                {SLOT_ORDER.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setActiveSlot(slot)}
                    className={`rounded-full border px-3 py-1 text-xs ${activeSlot === slot ? 'border-[#ffd28b99] bg-[#ffd28b22]' : 'border-white/25'}`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
              <p className="mb-2 text-xs text-[#c9c2e8]">Select a slot, then click an item to assign it.</p>
              <div className="grid max-h-[420px] grid-cols-2 gap-2 overflow-auto pr-1">
                {readyItems.map((item) => (
                  <button key={item.id} onClick={() => assignToSlot(item)} className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 p-2 text-left">
                    <img src={item.image_path || '/Images/background.png'} alt={item.name} className="h-14 w-10 rounded object-cover" />
                    <div className="min-w-0">
                      <p className="truncate text-xs text-[#F6F2FF]">{item.name}</p>
                      <p className="truncate text-[11px] text-[#BFB8E6]">{item.category || 'Uncategorized'}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="rounded-2xl border border-white/15 bg-white/5 p-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-[#c5b6ef]">Vertical Preview</p>
                <div className="mx-auto h-[72vh] max-h-[900px] min-h-[720px] w-full max-w-[520px] min-w-[420px] overflow-y-auto rounded-2xl border border-white/15 bg-[rgba(255,255,255,0.03)] p-4 max-[560px]:h-[68vh] max-[560px]:min-h-[560px] max-[560px]:min-w-0">
                  <div className="flex min-h-full flex-col items-center justify-start gap-3">
                  {previewSlots.map((slot) => {
                    const item = slotMap[slot];
                    return (
                      <div key={slot} className="w-full text-center">
                        <p className="mb-1 text-[10px] uppercase tracking-wide text-[#a99fd3]">{slot}</p>
                        {item ? (
                          <img
                            src={item.image_path || '/Images/background.png'}
                            alt={item.name}
                            className="mx-auto block w-[75%] max-w-[390px] rounded-xl object-contain"
                          />
                        ) : (
                          <div className="mx-auto h-8 w-[75%] rounded-xl border border-dashed border-white/20 bg-[rgba(255,255,255,0.02)]" />
                        )}
                      </div>
                    );
                  })}
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <input value={outfitName} onChange={(e) => setOutfitName(e.target.value)} placeholder="Outfit name" className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm" />
                <input value={outfitVibe} onChange={(e) => setOutfitVibe(e.target.value)} placeholder="Vibe" className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm" />
                <button onClick={() => void saveOutfit()} className="w-full rounded-xl border border-[#a3f7c366] bg-[#a3f7c322] px-3 py-2 text-xs">Save Outfit</button>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-xs uppercase tracking-wide text-[#c5b6ef]">Saved Looks</p>
                <div className="max-h-[240px] space-y-2 overflow-auto pr-1">
                  {outfits.map((outfit) => (
                    <article key={outfit.id} className="rounded-xl border border-white/15 bg-white/5 p-2">
                      <p className="text-sm text-[#F6F2FF]">{outfit.name}</p>
                      <p className="text-xs text-[#BFB8E6]">{outfit.vibe || 'No vibe'} • {outfit.items.length} pieces</p>
                    </article>
                  ))}
                  {outfits.length === 0 ? <p className="text-xs text-[#BFB8E6]">No outfits saved yet.</p> : null}
                </div>
              </div>
            </div>
          </div>
        </ModalShell>
      )}
    </>
  );
}
