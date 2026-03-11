'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CSS } from '@dnd-kit/utilities';
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { BackgroundShell } from '../layout/BackgroundShell';

type VintedSummary = {
  revenue: number;
  fees: number;
  invested: number;
  net_profit: number;
  roi_percentage: number;
  active_listings: number;
  sold_count: number;
};
type VintedInsights = {
  low_listing_stock: boolean;
  listed_count: number;
  stale_unsold_count: number;
  stale_rule: string;
  top_selling_category: string | null;
  top_selling_category_count: number;
  average_margin_percent: number;
  ops_tasks: string[];
  alerts: Array<{ id: string; title: string; detail: string; priority: number }>;
};
type VintedBundle = {
  id: number;
  supplier: string;
  bundle_name: string;
  quantity_expected: number;
  total_cost: number;
  status: 'ordered' | 'shipped' | 'delivered';
  ordered_at: string | null;
  eta_date: string | null;
  delivered_at: string | null;
};
type VintedExpense = {
  id: number;
  type: 'packaging' | 'other';
  name: string;
  quantity: number | null;
  cost: number;
  created_at: string;
};

type ViewKey = 'dashboard' | 'inventory' | 'wholesale' | 'investments' | 'insights';
type StatusFilter = 'all' | 'draft' | 'listed' | 'reserved' | 'sold';
type InventoryMode = 'grid' | 'pipeline';

type VintedItem = {
  id: number;
  title: string;
  category: string | null;
  size: string | null;
  condition: string | null;
  cost_price: number;
  intended_price: number | null;
  sale_price: number | null;
  platform_fee: number | null;
  sold_at: string | null;
  status: 'draft' | 'listed' | 'reserved' | 'sold';
  image_path: string | null;
  bundle_id: number | null;
};

type ItemFormState = {
  id?: number;
  title: string;
  category: string;
  size: string;
  condition: string;
  cost_price: string;
  intended_price: string;
  status: 'draft' | 'listed' | 'reserved' | 'sold';
  bundle_id: string;
  image_path: string;
};
type BundleFormState = {
  id?: number;
  supplier: string;
  bundle_name: string;
  quantity_expected: string;
  total_cost: string;
  status: 'ordered' | 'shipped' | 'delivered';
  eta_date: string;
};
type ExpenseFormState = {
  type: 'packaging' | 'other';
  name: string;
  quantity: string;
  cost: string;
};

const NAV_ITEMS: Array<{ key: ViewKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'wholesale', label: 'Wholesale Orders' },
  { key: 'investments', label: 'Investments' },
  { key: 'insights', label: 'Insights' },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function KpiCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.60)] p-4 backdrop-blur-xl transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_0_28px_rgba(255,62,165,0.2)] max-[840px]:p-3">
      <p className="font-sans text-xs uppercase tracking-[0.14em] text-[#B9B4D9]">{label}</p>
      <p className={`mt-2 font-sans text-2xl max-[840px]:text-lg ${accent ? 'text-[#FF3EA5]' : 'text-[#F8F4FF]'}`}>{value}</p>
    </div>
  );
}

function statusBadgeClass(status: VintedItem['status']) {
  if (status === 'listed') return 'border-[#FF3EA566] bg-[#FF3EA522] text-[#FF8CCF]';
  if (status === 'reserved') return 'border-[#C084FC66] bg-[#C084FC22] text-[#DDBDFF]';
  if (status === 'sold') return 'border-[#47d58c66] bg-[#47d58c22] text-[#9ef0c2]';
  return 'border-white/20 bg-white/10 text-[#B9B4D9]';
}

function emptyForm(): ItemFormState {
  return {
    title: '',
    category: '',
    size: '',
    condition: '',
    cost_price: '',
    intended_price: '',
    status: 'draft',
    bundle_id: '',
    image_path: '',
  };
}

function nowLocalDateTimeInputValue() {
  const now = new Date();
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function emptyBundleForm(): BundleFormState {
  return {
    supplier: '',
    bundle_name: '',
    quantity_expected: '',
    total_cost: '',
    status: 'ordered',
    eta_date: '',
  };
}

function emptyExpenseForm(): ExpenseFormState {
  return {
    type: 'packaging',
    name: '',
    quantity: '',
    cost: '',
  };
}

function PipelineCard({
  item,
  dragging = false,
}: {
  item: VintedItem;
  dragging?: boolean;
}) {
  return (
    <article
      className={`flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/25 p-2 transition-all duration-200 ${
        dragging ? 'opacity-70' : 'hover:-translate-y-[1px] hover:shadow-[0_0_18px_rgba(255,62,165,0.18)]'
      }`}
    >
      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/30">
        <Image
          src={item.image_path || '/SathiPlays/Images/background.png'}
          alt={item.title}
          fill
          className="object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-sans text-xs text-[#F8F4FF]">{item.title}</p>
        <p className="font-sans text-[10px] text-[#B9B4D9]">
          {item.size || '—'} • {formatCurrency(item.intended_price ?? item.cost_price)}
        </p>
      </div>
    </article>
  );
}

function DraggablePipelineCard({ item }: { item: VintedItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `item-${item.id}`,
    data: { itemId: item.id, status: item.status, item },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <PipelineCard item={item} dragging={isDragging} />
    </div>
  );
}

function PipelineColumn({
  id,
  title,
  items,
}: {
  id: Exclude<StatusFilter, 'all'>;
  title: string;
  items: VintedItem[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      className={`min-h-0 rounded-2xl border p-2.5 transition-all ${
        isOver
          ? 'border-[#FF3EA566] bg-[#FF3EA514]'
          : 'border-white/10 bg-black/20'
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <h4 className="font-sans text-xs uppercase tracking-[0.12em] text-[#F8F4FF]">{title}</h4>
        <span className="rounded-full border border-white/20 px-2 py-0.5 font-sans text-[10px] text-[#B9B4D9]">
          {items.length}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <DraggablePipelineCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

export function VintedWorld() {
  const [activeView, setActiveView] = useState<ViewKey>('dashboard');
  const [summary, setSummary] = useState<VintedSummary | null>(null);
  const [insights, setInsights] = useState<VintedInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<VintedItem[]>([]);
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsTotalPages, setItemsTotalPages] = useState(1);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [inventoryMode, setInventoryMode] = useState<InventoryMode>('grid');
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<ItemFormState>(emptyForm);
  const [activeDragItem, setActiveDragItem] = useState<VintedItem | null>(null);
  const [bundles, setBundles] = useState<VintedBundle[]>([]);
  const [bundlesLoading, setBundlesLoading] = useState(false);
  const [bundleModalOpen, setBundleModalOpen] = useState(false);
  const [bundleForm, setBundleForm] = useState<BundleFormState>(emptyBundleForm);
  const [processBundleId, setProcessBundleId] = useState<number | null>(null);
  const [expenses, setExpenses] = useState<VintedExpense[]>([]);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(emptyExpenseForm);
  const [soldModalOpen, setSoldModalOpen] = useState(false);
  const [soldDraft, setSoldDraft] = useState<{ itemId: number; salePrice: string; platformFee: string; soldAt: string } | null>(null);
  const [statusConfirm, setStatusConfirm] = useState<{ itemId: number; toStatus: VintedItem['status'] } | null>(null);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/vinted/summary', { cache: 'no-store' });
      if (!response.ok) throw new Error('summary_failed');
      const payload = (await response.json()) as VintedSummary;
      setSummary(payload);
    } catch {
      setSummary({
        revenue: 0,
        fees: 0,
        invested: 0,
        net_profit: 0,
        roi_percentage: 0,
        active_listings: 0,
        sold_count: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadInsights = useCallback(async () => {
    try {
      const response = await fetch('/api/vinted/insights', { cache: 'no-store' });
      if (!response.ok) throw new Error('insights_failed');
      const payload = (await response.json()) as VintedInsights;
      setInsights(payload);
    } catch {
      setInsights(null);
    }
  }, []);

  const loadBundles = useCallback(async () => {
    setBundlesLoading(true);
    try {
      const response = await fetch('/api/vinted/bundles', { cache: 'no-store' });
      if (!response.ok) throw new Error('bundles_failed');
      const payload = (await response.json()) as VintedBundle[];
      setBundles(Array.isArray(payload) ? payload : []);
    } catch {
      setBundles([]);
    } finally {
      setBundlesLoading(false);
    }
  }, []);

  const loadExpenses = useCallback(async () => {
    try {
      const response = await fetch('/api/vinted/expenses', { cache: 'no-store' });
      if (!response.ok) throw new Error('expenses_failed');
      const payload = (await response.json()) as VintedExpense[];
      setExpenses(Array.isArray(payload) ? payload : []);
    } catch {
      setExpenses([]);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
    void loadInsights();
  }, [loadInsights]);

  useEffect(() => {
    if (activeView === 'wholesale') void loadBundles();
    if (activeView === 'investments') {
      void loadBundles();
      void loadExpenses();
    }
  }, [activeView, loadBundles, loadExpenses]);

  const loadItems = useCallback(async () => {
    setItemsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      params.set('page', String(itemsPage));
      params.set('limit', '18');
      const response = await fetch(`/api/vinted/items?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('items_failed');
      const payload = (await response.json()) as
        | VintedItem[]
        | { items: VintedItem[]; page?: number; total_pages?: number };
      if (Array.isArray(payload)) {
        setItems(payload);
        setItemsTotalPages(1);
      } else {
        setItems(Array.isArray(payload.items) ? payload.items : []);
        setItemsPage(Number(payload.page ?? itemsPage));
        setItemsTotalPages(Math.max(1, Number(payload.total_pages ?? 1)));
      }
    } catch {
      setItems([]);
      setItemsTotalPages(1);
    } finally {
      setItemsLoading(false);
    }
  }, [search, statusFilter, itemsPage]);

  useEffect(() => {
    if (activeView !== 'inventory') return;
    const timer = setTimeout(() => {
      void loadItems();
    }, 220);

    return () => clearTimeout(timer);
  }, [activeView, loadItems]);

  useEffect(() => {
    setItemsPage(1);
  }, [search, statusFilter]);

  const healthText = useMemo(() => {
    if (!summary) return 'Loading business pulse...';
    if (summary.net_profit >= 0) return 'Profit runway is healthy and stable.';
    return 'Costs are currently ahead of sales.';
  }, [summary]);

  const prioritizedAlerts = insights?.alerts ?? [];
  const hasLowListingStock = (insights?.listed_count ?? summary?.active_listings ?? 0) < 10;

  const openAddModal = () => {
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEditModal = (item: VintedItem) => {
    setForm({
      id: item.id,
      title: item.title ?? '',
      category: item.category ?? '',
      size: item.size ?? '',
      condition: item.condition ?? '',
      cost_price: String(item.cost_price ?? ''),
      intended_price: item.intended_price == null ? '' : String(item.intended_price),
      status: item.status,
      bundle_id: item.bundle_id == null ? '' : String(item.bundle_id),
      image_path: item.image_path ?? '',
    });
    setModalOpen(true);
  };

  const submitItem = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        category: form.category || null,
        size: form.size || null,
        condition: form.condition || null,
        cost_price: Number(form.cost_price || 0),
        intended_price: form.intended_price === '' ? null : Number(form.intended_price),
        status: form.status,
        bundle_id: form.bundle_id === '' ? null : Number(form.bundle_id),
        image_path: form.image_path || null,
      };

      if (form.id) {
        await fetch(`/api/vinted/items/${form.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch('/api/vinted/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      setModalOpen(false);
      setMenuOpenId(null);
      setSearch('');
      setStatusFilter('all');
      setItemsPage(1);
      setActiveView('inventory');
      await loadItems();
      await loadSummary();
      await loadInsights();
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (id: number) => {
    await fetch(`/api/vinted/items/${id}`, { method: 'DELETE' });
    setItems((prev) => prev.filter((item) => item.id !== id));
    setMenuOpenId(null);
    await loadSummary();
    await loadInsights();
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set('file', file);
      const response = await fetch('/api/vinted/items/upload', { method: 'POST', body: formData });
      if (!response.ok) return;
      const payload = (await response.json()) as { image_path?: string };
      if (payload.image_path) setForm((prev) => ({ ...prev, image_path: payload.image_path ?? '' }));
    } finally {
      setUploading(false);
    }
  };

  const patchItemStatus = async (itemId: number, toStatus: VintedItem['status'], clearSoldFields = false) => {
    const response = await fetch(`/api/vinted/items/${itemId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: toStatus, clear_sold_fields: clearSoldFields }),
    });

    return response.ok;
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragStart = (event: DragStartEvent) => {
    const item = event.active.data.current?.item as VintedItem | undefined;
    setActiveDragItem(item ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragItem(null);
    const overStatus = event.over?.id as VintedItem['status'] | undefined;
    const itemId = event.active.data.current?.itemId as number | undefined;
    const fromStatus = event.active.data.current?.status as VintedItem['status'] | undefined;

    if (!itemId || !overStatus || !fromStatus || overStatus === fromStatus) return;

    if (overStatus === 'sold') {
      setSoldDraft({
        itemId,
        salePrice: '',
        platformFee: '0',
        soldAt: nowLocalDateTimeInputValue(),
      });
      setSoldModalOpen(true);
      return;
    }

    if (fromStatus === 'sold') {
      setStatusConfirm({ itemId, toStatus: overStatus });
      return;
    }

    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, status: overStatus } : item)));
    setMenuOpenId(null);

    const ok = await patchItemStatus(itemId, overStatus);
    if (!ok) {
      setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, status: fromStatus } : item)));
      return;
    }
    await loadSummary();
    await loadInsights();
  };

  const saveSoldDetails = async () => {
    if (!soldDraft) return;
    const salePrice = Number(soldDraft.salePrice);
    const platformFee = Number(soldDraft.platformFee || 0);
    if (!Number.isFinite(salePrice) || salePrice < 0 || !soldDraft.soldAt) return;

    const response = await fetch(`/api/vinted/items/${soldDraft.itemId}/sold`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sale_price: salePrice,
        platform_fee: Number.isFinite(platformFee) ? platformFee : 0,
        sold_at: soldDraft.soldAt,
      }),
    });
    if (!response.ok) return;

    setItems((prev) =>
      prev.map((item) =>
        item.id === soldDraft.itemId
          ? {
              ...item,
              status: 'sold',
              sale_price: salePrice,
              platform_fee: Number.isFinite(platformFee) ? platformFee : 0,
              sold_at: soldDraft.soldAt,
            }
          : item,
      ),
    );
    setSoldModalOpen(false);
    setSoldDraft(null);
    await loadSummary();
    await loadInsights();
  };

  const confirmMoveOutOfSold = async () => {
    if (!statusConfirm) return;
    const current = items.find((item) => item.id === statusConfirm.itemId);
    if (!current) {
      setStatusConfirm(null);
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === statusConfirm.itemId
          ? { ...item, status: statusConfirm.toStatus, sale_price: null, platform_fee: null, sold_at: null }
          : item,
      ),
    );
    const ok = await patchItemStatus(statusConfirm.itemId, statusConfirm.toStatus, true);
    if (!ok) {
      setItems((prev) => prev.map((item) => (item.id === current.id ? current : item)));
      setStatusConfirm(null);
      return;
    }

    setStatusConfirm(null);
    await loadSummary();
    await loadInsights();
  };

  const submitBundle = async () => {
    if (!bundleForm.supplier.trim() || !bundleForm.bundle_name.trim()) return;
    const payload = {
      supplier: bundleForm.supplier,
      bundle_name: bundleForm.bundle_name,
      quantity_expected: Number(bundleForm.quantity_expected || 0),
      total_cost: Number(bundleForm.total_cost || 0),
      status: bundleForm.status,
      eta_date: bundleForm.eta_date || null,
    };
    if (bundleForm.id) {
      await fetch('/api/vinted/bundles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bundleForm.id, ...payload }),
      });
    } else {
      await fetch('/api/vinted/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    setBundleModalOpen(false);
    setBundleForm(emptyBundleForm());
    await loadBundles();
    await loadSummary();
    await loadInsights();
  };

  const updateBundleStatus = async (id: number, status: VintedBundle['status']) => {
    await fetch('/api/vinted/bundles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    await loadBundles();
    await loadSummary();
    await loadInsights();
  };

  const deleteBundle = async (id: number) => {
    await fetch(`/api/vinted/bundles?id=${id}`, { method: 'DELETE' });
    await loadBundles();
    await loadSummary();
    await loadInsights();
  };

  const openBundleEdit = (bundle: VintedBundle) => {
    setBundleForm({
      id: bundle.id,
      supplier: bundle.supplier,
      bundle_name: bundle.bundle_name,
      quantity_expected: String(bundle.quantity_expected),
      total_cost: String(bundle.total_cost),
      status: bundle.status,
      eta_date: bundle.eta_date ?? '',
    });
    setBundleModalOpen(true);
  };

  const submitExpense = async () => {
    if (!expenseForm.name.trim()) return;
    await fetch('/api/vinted/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: expenseForm.type,
        name: expenseForm.name,
        quantity: expenseForm.quantity === '' ? null : Number(expenseForm.quantity),
        cost: Number(expenseForm.cost || 0),
      }),
    });
    setExpenseModalOpen(false);
    setExpenseForm(emptyExpenseForm());
    await loadExpenses();
    await loadSummary();
    await loadInsights();
  };

  const deleteExpense = async (id: number) => {
    await fetch(`/api/vinted/expenses?id=${id}`, { method: 'DELETE' });
    await loadExpenses();
    await loadSummary();
    await loadInsights();
  };

  return (
    <BackgroundShell overlayClassName="bg-[radial-gradient(circle_at_52%_18%,rgba(255,62,165,0.12),rgba(192,132,252,0.08)_35%,rgba(8,6,24,0.82)_70%)]">
      <div className="mx-auto h-full w-full max-w-[1600px] overflow-hidden px-4 py-3 max-[900px]:px-2 max-[900px]:py-1.5">
        <div className="grid h-full grid-cols-[18%_57%_25%] gap-3 overflow-hidden max-[900px]:grid-cols-[17%_58%_25%] max-[900px]:gap-1.5">
          <aside className="rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.60)] p-3 backdrop-blur-xl max-[840px]:p-2">
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const active = item.key === activeView;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveView(item.key)}
                    className={`group relative flex w-full items-center rounded-xl px-3 py-2.5 text-left font-sans text-sm transition-all duration-200 max-[840px]:px-2 max-[840px]:py-1.5 max-[840px]:text-xs ${
                      active ? 'bg-white/10 text-[#F8F4FF]' : 'text-[#B9B4D9] hover:bg-white/5 hover:text-[#F8F4FF]'
                    }`}
                  >
                    <span
                      className={`absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[#FF3EA5] transition-opacity ${
                        active ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
                      }`}
                    />
                    <span className="pl-2">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="min-h-0 rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.60)] p-4 backdrop-blur-xl max-[840px]:p-2.5">
            {activeView === 'dashboard' ? (
              <div className="flex h-full min-h-0 flex-col">
                <div className="mb-3 flex items-center justify-between max-[840px]:mb-2">
                  <h2 className="font-serif text-3xl text-[#F8F4FF] max-[840px]:text-xl">Dashboard</h2>
                  <span className="rounded-full border border-[#C084FC66] bg-[#C084FC1A] px-3 py-1 font-sans text-xs text-[#C084FC]">
                    Live KPIs
                  </span>
                </div>
                {loading ? (
                  <div className="grid grid-cols-2 gap-3">
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <div key={idx} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 overflow-y-auto pr-1 max-[840px]:gap-2">
                    <KpiCard label="Revenue" value={formatCurrency(summary?.revenue ?? 0)} />
                    <KpiCard label="Fees" value={formatCurrency(summary?.fees ?? 0)} />
                    <KpiCard label="Invested" value={formatCurrency(summary?.invested ?? 0)} />
                    <KpiCard label="Net Profit" value={formatCurrency(summary?.net_profit ?? 0)} accent />
                    <KpiCard label="ROI %" value={`${Number(summary?.roi_percentage ?? 0).toFixed(1)}%`} />
                    <KpiCard label="Active Listings" value={String(summary?.active_listings ?? 0)} />
                    <KpiCard label="Sold Count" value={String(summary?.sold_count ?? 0)} />
                  </div>
                )}
              </div>
            ) : activeView === 'inventory' ? (
              <div className="flex h-full min-h-0 flex-col">
                <div className="mb-3 flex items-center gap-2 max-[840px]:mb-2">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search title, size, category..."
                    className="h-10 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 font-sans text-sm text-[#F8F4FF] outline-none placeholder:text-[#B9B4D9] max-[840px]:h-8 max-[840px]:text-xs"
                  />
                  <button
                    type="button"
                    onClick={openAddModal}
                    className="h-10 rounded-xl border border-[#FF3EA566] bg-[#FF3EA522] px-4 font-sans text-sm text-[#F8F4FF] transition-all duration-200 hover:-translate-y-[1px] max-[840px]:h-8 max-[840px]:px-3 max-[840px]:text-xs"
                  >
                    + Add Item
                  </button>
                </div>
                {hasLowListingStock && (
                  <div className="mb-3 rounded-xl border border-[#FF3EA566] bg-[#FF3EA522] px-3 py-2">
                    <p className="font-sans text-xs text-[#F8F4FF]">Low listing stock — list/source more</p>
                  </div>
                )}
                <div className="mb-3 flex items-center justify-between gap-2 max-[840px]:mb-2">
                  <div className="flex flex-wrap gap-2">
                    {(['all', 'draft', 'listed', 'reserved', 'sold'] as StatusFilter[]).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setStatusFilter(tab)}
                        className={`rounded-full border px-3 py-1 font-sans text-xs capitalize ${
                          statusFilter === tab
                            ? 'border-[#FF3EA566] bg-[#FF3EA522] text-[#F8F4FF]'
                            : 'border-white/20 bg-white/5 text-[#B9B4D9]'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center rounded-full border border-white/20 bg-black/20 p-1">
                    <button
                      type="button"
                      onClick={() => setInventoryMode('grid')}
                      className={`rounded-full px-3 py-1 font-sans text-xs ${
                        inventoryMode === 'grid'
                          ? 'bg-[#FF3EA522] text-[#F8F4FF]'
                          : 'text-[#B9B4D9]'
                      }`}
                    >
                      Grid
                    </button>
                    <button
                      type="button"
                      onClick={() => setInventoryMode('pipeline')}
                      className={`rounded-full px-3 py-1 font-sans text-xs ${
                        inventoryMode === 'pipeline'
                          ? 'bg-[#FF3EA522] text-[#F8F4FF]'
                          : 'text-[#B9B4D9]'
                      }`}
                    >
                      Pipeline
                    </button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  {itemsLoading ? (
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 max-[840px]:gap-2">
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={idx} className="h-56 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
                      ))}
                    </div>
                  ) : items.length === 0 ? (
                    <div className="grid h-full place-items-center rounded-2xl border border-white/10 bg-black/20">
                      <p className="font-sans text-sm text-[#B9B4D9]">No inventory items found.</p>
                    </div>
                  ) : (
                    inventoryMode === 'grid' ? (
                      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 max-[840px]:gap-2">
                        {items.map((item) => (
                          <article
                            key={item.id}
                            className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-2.5 transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_0_26px_rgba(255,62,165,0.18)]"
                          >
                            <div className="relative mb-2 h-32 w-full overflow-hidden rounded-xl border border-white/10 bg-black/30 max-[840px]:h-24">
                              <Image
                                src={item.image_path || '/SathiPlays/Images/background.png'}
                                alt={item.title}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="line-clamp-1 font-sans text-sm text-[#F8F4FF]">{item.title}</h3>
                                <button
                                  type="button"
                                  onClick={() => setMenuOpenId((prev) => (prev === item.id ? null : item.id))}
                                  className="rounded-md border border-white/15 px-2 py-0.5 text-xs text-[#B9B4D9]"
                                >
                                  ⋯
                                </button>
                              </div>
                              <p className="font-sans text-xs text-[#B9B4D9]">Size: {item.size || '—'}</p>
                              <p className="font-sans text-xs text-[#B9B4D9]">Cost: {formatCurrency(item.cost_price)}</p>
                              <p className="font-sans text-xs text-[#B9B4D9]">
                                Intended: {item.intended_price == null ? '—' : formatCurrency(item.intended_price)}
                              </p>
                              <span className={`inline-flex rounded-full border px-2 py-0.5 font-sans text-[10px] uppercase ${statusBadgeClass(item.status)}`}>
                                {item.status}
                              </span>
                            </div>
                            {menuOpenId === item.id && (
                              <div className="absolute right-3 top-11 z-10 w-28 rounded-xl border border-white/10 bg-[#120f2bcc] p-1 shadow-xl backdrop-blur-xl">
                                <button
                                  type="button"
                                  onClick={() => {
                                    openEditModal(item);
                                    setMenuOpenId(null);
                                  }}
                                  className="w-full rounded-lg px-2 py-1 text-left font-sans text-xs text-[#F8F4FF] hover:bg-white/10"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void removeItem(item.id)}
                                  className="w-full rounded-lg px-2 py-1 text-left font-sans text-xs text-[#ff9acb] hover:bg-white/10"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </article>
                        ))}
                      </div>
                    ) : (
                      <DndContext
                        sensors={sensors}
                        onDragStart={handleDragStart}
                        onDragEnd={(event) => void handleDragEnd(event)}
                      >
                        <div className="overflow-x-auto pb-1">
                          <div className="grid min-w-[520px] grid-cols-4 gap-2.5 max-[840px]:gap-2">
                          {(['draft', 'listed', 'reserved', 'sold'] as VintedItem['status'][]).map((status) => (
                            <PipelineColumn
                              key={status}
                              id={status}
                              title={status}
                              items={items.filter((item) => item.status === status)}
                            />
                          ))}
                          </div>
                        </div>
                        <DragOverlay>
                          {activeDragItem ? <PipelineCard item={activeDragItem} dragging /> : null}
                        </DragOverlay>
                      </DndContext>
                    )
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p className="font-sans text-xs text-[#B9B4D9]">
                    Page {itemsPage} of {itemsTotalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={itemsPage <= 1}
                      onClick={() => setItemsPage((prev) => Math.max(1, prev - 1))}
                      className="rounded-full border border-white/20 px-3 py-1 text-xs text-[#F8F4FF] disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      disabled={itemsPage >= itemsTotalPages}
                      onClick={() => setItemsPage((prev) => Math.min(itemsTotalPages, prev + 1))}
                      className="rounded-full border border-white/20 px-3 py-1 text-xs text-[#F8F4FF] disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            ) : activeView === 'wholesale' ? (
              <div className="flex h-full min-h-0 flex-col rounded-2xl border border-white/10 bg-black/20 p-4 max-[840px]:p-2.5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-serif text-3xl text-[#F8F4FF] max-[840px]:text-xl">Wholesale Orders</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setBundleForm(emptyBundleForm());
                      setBundleModalOpen(true);
                    }}
                    className="rounded-xl border border-[#FF3EA566] bg-[#FF3EA522] px-3 py-1.5 font-sans text-xs text-[#F8F4FF]"
                  >
                    + Add Bundle
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-white/10">
                  <table className="w-full min-w-[860px] table-fixed text-left">
                    <thead className="sticky top-0 bg-[#151233]/95 backdrop-blur-xl">
                      <tr className="border-b border-white/10">
                        <th className="px-3 py-2 font-sans text-[11px] uppercase tracking-[0.12em] text-[#B9B4D9]">Supplier</th>
                        <th className="px-3 py-2 font-sans text-[11px] uppercase tracking-[0.12em] text-[#B9B4D9]">Bundle Name</th>
                        <th className="px-3 py-2 font-sans text-[11px] uppercase tracking-[0.12em] text-[#B9B4D9]">Qty Expected</th>
                        <th className="px-3 py-2 font-sans text-[11px] uppercase tracking-[0.12em] text-[#B9B4D9]">Total Cost</th>
                        <th className="px-3 py-2 font-sans text-[11px] uppercase tracking-[0.12em] text-[#B9B4D9]">Status</th>
                        <th className="px-3 py-2 font-sans text-[11px] uppercase tracking-[0.12em] text-[#B9B4D9]">ETA</th>
                        <th className="px-3 py-2 font-sans text-[11px] uppercase tracking-[0.12em] text-[#B9B4D9]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bundlesLoading ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-5 font-sans text-sm text-[#B9B4D9]">Loading bundles...</td>
                        </tr>
                      ) : bundles.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-5 font-sans text-sm text-[#B9B4D9]">No bundles yet.</td>
                        </tr>
                      ) : (
                        bundles.map((bundle) => (
                          <tr key={bundle.id} className="border-b border-white/10">
                            <td className="px-3 py-2 font-sans text-sm text-[#F8F4FF]">{bundle.supplier}</td>
                            <td className="px-3 py-2 font-sans text-sm text-[#F8F4FF]">{bundle.bundle_name}</td>
                            <td className="px-3 py-2 font-sans text-sm text-[#B9B4D9]">{bundle.quantity_expected}</td>
                            <td className="px-3 py-2 font-sans text-sm text-[#B9B4D9]">{formatCurrency(bundle.total_cost)}</td>
                            <td className="px-3 py-2">
                              <select
                                value={bundle.status}
                                onChange={(e) => void updateBundleStatus(bundle.id, e.target.value as VintedBundle['status'])}
                                className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 font-sans text-xs text-[#F8F4FF]"
                              >
                                <option value="ordered">ordered</option>
                                <option value="shipped">shipped</option>
                                <option value="delivered">delivered</option>
                              </select>
                            </td>
                            <td className="px-3 py-2 font-sans text-sm text-[#B9B4D9]">{bundle.eta_date || '—'}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openBundleEdit(bundle)}
                                  className="rounded-lg border border-white/20 px-2 py-1 font-sans text-[11px] text-[#F8F4FF]"
                                >
                                  Edit
                                </button>
                                {bundle.status === 'delivered' && (
                                  <button
                                    type="button"
                                    onClick={() => setProcessBundleId(bundle.id)}
                                    className="rounded-lg border border-[#C084FC66] bg-[#C084FC22] px-2 py-1 font-sans text-[11px] text-[#F8F4FF]"
                                  >
                                    Process inventory
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => void deleteBundle(bundle.id)}
                                  className="rounded-lg border border-white/20 px-2 py-1 font-sans text-[11px] text-[#ff9acb]"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeView === 'investments' ? (
              <div className="flex h-full min-h-0 flex-col rounded-2xl border border-white/10 bg-black/20 p-4 max-[840px]:p-2.5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-serif text-3xl text-[#F8F4FF] max-[840px]:text-xl">Investments</h2>
                  <button
                    type="button"
                    onClick={() => setExpenseModalOpen(true)}
                    className="rounded-xl border border-[#FF3EA566] bg-[#FF3EA522] px-3 py-1.5 font-sans text-xs text-[#F8F4FF]"
                  >
                    + Add Expense
                  </button>
                </div>
                <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto pr-1 max-[840px]:gap-2">
                  <section className="rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.6)] p-3">
                    <h3 className="font-serif text-2xl text-[#F8F4FF]">Bundles Spend</h3>
                    <p className="mt-1 font-sans text-xs text-[#B9B4D9]">From vinted_bundles</p>
                    <div className="mt-3 space-y-2">
                      {bundles.filter((bundle) => bundle.status === 'delivered').map((bundle) => (
                        <div key={bundle.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                          <p className="font-sans text-sm text-[#F8F4FF]">{bundle.bundle_name}</p>
                          <p className="font-sans text-xs text-[#B9B4D9]">
                            {bundle.supplier} • {bundle.status} • {formatCurrency(bundle.total_cost)}
                          </p>
                        </div>
                      ))}
                      {bundles.filter((bundle) => bundle.status === 'delivered').length === 0 && (
                        <p className="font-sans text-sm text-[#B9B4D9]">No delivered bundles yet.</p>
                      )}
                    </div>
                  </section>
                  <section className="rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.6)] p-3">
                    <h3 className="font-serif text-2xl text-[#F8F4FF]">Packaging + Other Expenses</h3>
                    <p className="mt-1 font-sans text-xs text-[#B9B4D9]">From vinted_expenses</p>
                    <div className="mt-3 space-y-2">
                      {expenses.map((expense) => (
                        <div key={expense.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                          <div>
                            <p className="font-sans text-sm text-[#F8F4FF]">{expense.name}</p>
                            <p className="font-sans text-xs text-[#B9B4D9]">
                              {expense.type} {expense.quantity ? `• qty ${expense.quantity}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-sans text-sm text-[#F8F4FF]">{formatCurrency(expense.cost)}</span>
                            <button
                              type="button"
                              onClick={() => void deleteExpense(expense.id)}
                              className="rounded-lg border border-white/20 px-2 py-1 font-sans text-[11px] text-[#ff9acb]"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                      {expenses.length === 0 && <p className="font-sans text-sm text-[#B9B4D9]">No expenses yet.</p>}
                    </div>
                  </section>
                </div>
              </div>
            ) : activeView === 'insights' ? (
              <div className="flex h-full min-h-0 flex-col rounded-2xl border border-white/10 bg-black/20 p-4 max-[840px]:p-2.5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-serif text-3xl text-[#F8F4FF] max-[840px]:text-xl">Insights</h2>
                  <span className="rounded-full border border-[#C084FC66] bg-[#C084FC1A] px-3 py-1 font-sans text-xs text-[#C084FC]">
                    Project Manager Mode
                  </span>
                </div>
                <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto pr-1 max-[840px]:gap-2">
                  <div className="rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.6)] p-3">
                    <p className="font-sans text-xs uppercase tracking-[0.12em] text-[#B9B4D9]">Low listing stock</p>
                    <p className="mt-2 font-sans text-sm text-[#F8F4FF]">
                      {insights?.listed_count ?? 0} listed {insights?.low_listing_stock ? '(below target)' : '(healthy)'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.6)] p-3">
                    <p className="font-sans text-xs uppercase tracking-[0.12em] text-[#B9B4D9]">Unsold &gt;14 days</p>
                    <p className="mt-2 font-sans text-sm text-[#F8F4FF]">{insights?.stale_unsold_count ?? 0} items</p>
                    <p className="mt-1 font-sans text-[11px] text-[#B9B4D9]">{insights?.stale_rule ?? 'v1 uses created_at proxy'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.6)] p-3">
                    <p className="font-sans text-xs uppercase tracking-[0.12em] text-[#B9B4D9]">Top selling category</p>
                    <p className="mt-2 font-sans text-sm text-[#F8F4FF]">
                      {insights?.top_selling_category || 'No sold category yet'}
                    </p>
                    <p className="mt-1 font-sans text-[11px] text-[#B9B4D9]">
                      Sold count: {insights?.top_selling_category_count ?? 0}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.6)] p-3">
                    <p className="font-sans text-xs uppercase tracking-[0.12em] text-[#B9B4D9]">Average margin %</p>
                    <p className="mt-2 font-sans text-sm text-[#F8F4FF]">
                      {Number(insights?.average_margin_percent ?? 0).toFixed(1)}%
                    </p>
                    <p className="mt-1 font-sans text-[11px] text-[#B9B4D9]">
                      Formula: avg((sale - cost - fee) / cost)
                    </p>
                  </div>
                  <div className="col-span-2 rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.6)] p-3">
                    <p className="font-sans text-xs uppercase tracking-[0.12em] text-[#B9B4D9]">Ops Tasks</p>
                    <ul className="mt-2 space-y-2">
                      {(insights?.ops_tasks ?? []).map((task) => (
                        <li key={task} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 font-sans text-sm text-[#F8F4FF]">
                          {task}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-0 flex-col rounded-2xl border border-white/10 bg-black/20 p-4">
                <h2 className="font-serif text-3xl text-[#F8F4FF]">{NAV_ITEMS.find((item) => item.key === activeView)?.label}</h2>
                <p className="mt-2 font-sans text-sm text-[#B9B4D9]">
                  This workspace is ready for focused operations in the selected module.
                </p>
                <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3 font-sans text-sm text-[#B9B4D9]">
                  <p className="mb-2">This panel keeps the Spotify-style clean workspace rhythm for focused ops.</p>
                  <p>Use sidebar nav to switch modules while keeping context in the right insights column.</p>
                </div>
              </div>
            )}
          </main>

          <aside className="min-h-0 overflow-y-auto rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.60)] p-4 pr-3 backdrop-blur-xl max-[840px]:p-2.5 max-[840px]:pr-2">
            <h3 className="font-serif text-2xl text-[#F8F4FF] max-[840px]:text-lg">Alerts & Insights</h3>
            <div className="mt-3 space-y-3 pr-1">
              {hasLowListingStock && (
                <div className="rounded-xl border border-[#FF3EA566] bg-[#FF3EA522] p-3">
                  <p className="font-sans text-xs uppercase tracking-[0.12em] text-[#ffd0ec]">Critical</p>
                  <p className="mt-2 font-sans text-sm text-[#F8F4FF]">Low listing stock — list/source more</p>
                </div>
              )}
              {prioritizedAlerts.filter((a) => a.id !== 'low-listing-stock').slice(0, 3).map((alert) => (
                <div key={alert.id} className="rounded-xl border border-[#FF3EA566] bg-[#FF3EA522] p-3">
                  <p className="font-sans text-xs uppercase tracking-[0.12em] text-[#ffd0ec]">{alert.title}</p>
                  <p className="mt-2 font-sans text-sm text-[#F8F4FF]">{alert.detail}</p>
                </div>
              ))}
              {!hasLowListingStock && prioritizedAlerts.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="font-sans text-xs uppercase tracking-[0.12em] text-[#B9B4D9]">Alerts</p>
                  <p className="mt-2 font-sans text-sm text-[#F8F4FF]">No critical alerts right now.</p>
                </div>
              )}
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="font-sans text-xs uppercase tracking-[0.12em] text-[#B9B4D9]">Business Pulse</p>
                <p className="mt-2 font-sans text-sm text-[#F8F4FF]">{healthText}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="font-sans text-xs uppercase tracking-[0.12em] text-[#B9B4D9]">Listings</p>
                <p className="mt-2 font-sans text-sm text-[#F8F4FF]">
                  {summary?.active_listings ?? 0} active right now. Keep title quality and image consistency high.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="font-sans text-xs uppercase tracking-[0.12em] text-[#B9B4D9]">Margin Watch</p>
                <p className="mt-2 font-sans text-sm text-[#F8F4FF]">
                  Revenue {formatCurrency(summary?.revenue ?? 0)} • Fees {formatCurrency(summary?.fees ?? 0)}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {bundleModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.92)] p-4 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-serif text-2xl text-[#F8F4FF]">{bundleForm.id ? 'Edit Bundle' : 'Add Bundle'}</h3>
              <button
                type="button"
                onClick={() => setBundleModalOpen(false)}
                className="rounded-full border border-white/20 px-3 py-1 text-xs text-[#B9B4D9]"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Supplier</span>
                <input value={bundleForm.supplier} onChange={(e) => setBundleForm((p) => ({ ...p, supplier: e.target.value }))} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]" />
              </label>
              <label className="col-span-2 space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Bundle name</span>
                <input value={bundleForm.bundle_name} onChange={(e) => setBundleForm((p) => ({ ...p, bundle_name: e.target.value }))} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]" />
              </label>
              <label className="space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Qty expected</span>
                <input type="number" min="0" value={bundleForm.quantity_expected} onChange={(e) => setBundleForm((p) => ({ ...p, quantity_expected: e.target.value }))} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]" />
              </label>
              <label className="space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Total cost</span>
                <input type="number" min="0" step="0.01" value={bundleForm.total_cost} onChange={(e) => setBundleForm((p) => ({ ...p, total_cost: e.target.value }))} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]" />
              </label>
              <label className="space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Status</span>
                <select value={bundleForm.status} onChange={(e) => setBundleForm((p) => ({ ...p, status: e.target.value as BundleFormState['status'] }))} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]">
                  <option value="ordered">ordered</option>
                  <option value="shipped">shipped</option>
                  <option value="delivered">delivered</option>
                </select>
              </label>
              <label className="space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>ETA</span>
                <input type="date" value={bundleForm.eta_date} onChange={(e) => setBundleForm((p) => ({ ...p, eta_date: e.target.value }))} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]" />
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => void submitBundle()} className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-4 py-1.5 font-sans text-xs text-[#F8F4FF]">
                {bundleForm.id ? 'Save Changes' : 'Save Bundle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {expenseModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.92)] p-4 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-serif text-2xl text-[#F8F4FF]">Add Expense</h3>
              <button type="button" onClick={() => setExpenseModalOpen(false)} className="rounded-full border border-white/20 px-3 py-1 text-xs text-[#B9B4D9]">
                Close
              </button>
            </div>
            <div className="space-y-3">
              <label className="block space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Type</span>
                <select value={expenseForm.type} onChange={(e) => setExpenseForm((p) => ({ ...p, type: e.target.value as ExpenseFormState['type'] }))} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]">
                  <option value="packaging">packaging</option>
                  <option value="other">other</option>
                </select>
              </label>
              <label className="block space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Name</span>
                <input value={expenseForm.name} onChange={(e) => setExpenseForm((p) => ({ ...p, name: e.target.value }))} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]" />
              </label>
              <label className="block space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Quantity (optional)</span>
                <input type="number" min="0" value={expenseForm.quantity} onChange={(e) => setExpenseForm((p) => ({ ...p, quantity: e.target.value }))} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]" />
              </label>
              <label className="block space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Cost</span>
                <input type="number" min="0" step="0.01" value={expenseForm.cost} onChange={(e) => setExpenseForm((p) => ({ ...p, cost: e.target.value }))} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]" />
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => void submitExpense()} className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-4 py-1.5 font-sans text-xs text-[#F8F4FF]">
                Save Expense
              </button>
            </div>
          </div>
        </div>
      )}

      {processBundleId !== null && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.92)] p-4 backdrop-blur-xl">
            <h3 className="font-serif text-2xl text-[#F8F4FF]">Process Inventory</h3>
            <p className="mt-2 font-sans text-sm text-[#B9B4D9]">
              Bundle #{processBundleId} is delivered. In v1, process inventory manually by adding items in Inventory.
            </p>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setProcessBundleId(null)} className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-4 py-1.5 font-sans text-xs text-[#F8F4FF]">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {soldModalOpen && soldDraft && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.92)] p-4 backdrop-blur-xl">
            <h3 className="font-serif text-2xl text-[#F8F4FF]">Sold Details</h3>
            <p className="mt-1 font-sans text-xs text-[#B9B4D9]">Add final sale values to complete Sold move.</p>
            <div className="mt-3 space-y-3">
              <label className="block space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Sale price *</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={soldDraft.salePrice}
                  onChange={(e) => setSoldDraft((prev) => (prev ? { ...prev, salePrice: e.target.value } : prev))}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                />
              </label>
              <label className="block space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Platform fee</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={soldDraft.platformFee}
                  onChange={(e) => setSoldDraft((prev) => (prev ? { ...prev, platformFee: e.target.value } : prev))}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                />
              </label>
              <label className="block space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Sold at</span>
                <input
                  type="datetime-local"
                  value={soldDraft.soldAt}
                  onChange={(e) => setSoldDraft((prev) => (prev ? { ...prev, soldAt: e.target.value } : prev))}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                />
              </label>
              <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                <p className="font-sans text-[11px] text-[#B9B4D9]">
                  Profit = sale_price - cost_price - platform_fee
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSoldModalOpen(false);
                  setSoldDraft(null);
                }}
                className="rounded-full border border-white/20 px-4 py-1.5 font-sans text-xs text-[#B9B4D9]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveSoldDetails()}
                className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-4 py-1.5 font-sans text-xs text-[#F8F4FF]"
              >
                Save Sold
              </button>
            </div>
          </div>
        </div>
      )}

      {statusConfirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.92)] p-4 backdrop-blur-xl">
            <h3 className="font-serif text-2xl text-[#F8F4FF]">Move Out of Sold?</h3>
            <p className="mt-2 font-sans text-sm text-[#B9B4D9]">
              This will clear sale price, platform fee, and sold date for this item.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStatusConfirm(null)}
                className="rounded-full border border-white/20 px-4 py-1.5 font-sans text-xs text-[#B9B4D9]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmMoveOutOfSold()}
                className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-4 py-1.5 font-sans text-xs text-[#F8F4FF]"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.90)] p-4 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-serif text-2xl text-[#F8F4FF]">{form.id ? 'Edit Item' : 'Add Item'}</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full border border-white/20 px-3 py-1 text-xs text-[#B9B4D9]"
              >
                Close
              </button>
            </div>
            <div className="grid max-h-[70vh] grid-cols-2 gap-3 overflow-y-auto pr-1">
              <label className="col-span-2 space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Image upload</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadImage(file);
                  }}
                  className="w-full rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-[#F8F4FF]"
                />
                {uploading && <span className="text-[11px] text-[#C084FC]">Uploading...</span>}
              </label>

              <label className="col-span-2 space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Title *</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                />
              </label>

              <label className="space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Category</span>
                <input
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                />
              </label>
              <label className="space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Size</span>
                <input
                  value={form.size}
                  onChange={(e) => setForm((prev) => ({ ...prev, size: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                />
              </label>

              <label className="space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Condition</span>
                <input
                  value={form.condition}
                  onChange={(e) => setForm((prev) => ({ ...prev, condition: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                />
              </label>
              <label className="space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Status</span>
                <select
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as ItemFormState['status'] }))}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                >
                  <option value="draft">Draft</option>
                  <option value="listed">Listed</option>
                  <option value="reserved">Reserved</option>
                  <option value="sold">Sold</option>
                </select>
              </label>

              <label className="space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Cost price</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cost_price}
                  onChange={(e) => setForm((prev) => ({ ...prev, cost_price: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                />
              </label>
              <label className="space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Intended price</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.intended_price}
                  onChange={(e) => setForm((prev) => ({ ...prev, intended_price: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                />
              </label>

              <label className="col-span-2 space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Bundle ID (optional)</span>
                <input
                  type="number"
                  min="1"
                  value={form.bundle_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, bundle_id: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => void submitItem()}
                disabled={saving || uploading}
                className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-4 py-1.5 font-sans text-sm text-[#F8F4FF] disabled:opacity-60"
              >
                {saving ? 'Saving...' : form.id ? 'Save changes' : 'Create item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </BackgroundShell>
  );
}
