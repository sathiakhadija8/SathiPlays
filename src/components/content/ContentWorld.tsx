'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CSS } from '@dnd-kit/utilities';
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { BackgroundShell } from '../layout/BackgroundShell';

type BrandKey = 'personal' | 'business';
type PipelineStatus = 'idea' | 'scripted' | 'filmed' | 'edited' | 'scheduled' | 'posted';
type Platform = 'tiktok' | 'instagram' | 'youtube' | 'pinterest' | 'facebook';
type SectionKey = 'pipeline' | 'scripts' | 'drafts' | 'calendar' | 'analytics' | 'affiliate' | 'pr';
type DraftFilter = 'all' | 'filmed' | 'edited' | 'scheduled';

type ContentSummary = {
  brand: { id: number; name: string; key: BrandKey };
  countsByStatus: Record<PipelineStatus, number>;
  upcomingScheduled: Array<{
    id: number;
    title: string;
    platform: string;
    scheduled_at: string;
    status: string;
  }>;
  draftsCount: number;
  alerts: string[];
};

type ContentItem = {
  id: number;
  brand_id: number;
  title: string;
  platform: Platform;
  category: string | null;
  status: PipelineStatus;
  script_id: number | null;
  monetized: number;
  created_at: string;
};

type DraftItem = {
  id: number;
  brand_id: number;
  title: string;
  platform: Platform;
  category: string | null;
  description: string | null;
  status: 'filmed' | 'edited' | 'scheduled';
  script_id: number | null;
  monetized: number;
  thumbnail_path: string | null;
  filmed_at: string | null;
  scheduled_at: string | null;
  created_at: string;
};

type ScriptItem = {
  id: number;
  brand_id: number;
  title: string;
  platform: Platform;
  category: string | null;
  monetized: number;
  hook_lines: string[];
  body: string;
  cta: string | null;
  hashtags: string | null;
  affiliate_id: number | null;
  created_at: string;
};

type CalendarItem = {
  id: number;
  title: string;
  platform: Platform;
  status: 'scheduled';
  scheduled_at: string;
};

type AnalyticsItem = {
  content_item_id: number;
  title: string;
  platform: Platform;
  category: string | null;
  posted_at: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  revenue: number;
  engagement_rate: number;
};

type AnalyticsSummary = {
  total_posts_posted: number;
  total_views: number;
  total_revenue: number;
  best_platform: { platform: string; views: number } | null;
  best_category: { category: string; avg_engagement: number } | null;
};

type AffiliateLink = {
  id: number;
  brand_id: number;
  network: string;
  product_name: string;
  url: string;
  commission_percent: number | null;
  created_at: string;
};

type AffiliateEarning = {
  id: number;
  affiliate_id: number;
  content_item_id: number | null;
  amount: number;
  earned_date: string;
  created_at: string;
};

type AffiliateSummary = {
  total_amount: number;
  logs_count: number;
  top_earners: Array<{ affiliate_id: number; product_name: string; total_amount: number }>;
};

type PrBrand = {
  id: number;
  brand_id: number;
  company_name: string;
  contact_email: string | null;
  contact_person: string | null;
  status: 'pitched' | 'in_discussion' | 'gifted' | 'paid' | 'declined';
  notes: string | null;
  created_at: string;
};

type PrDeliverable = {
  id: number;
  pr_brand_id: number;
  content_item_id: number | null;
  deadline: string | null;
  payment_amount: number | null;
  status: 'pending' | 'posted' | 'paid';
  posted_at: string | null;
  created_at: string;
};

const SHARED_NAV: Array<{ key: SectionKey; label: string }> = [
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'scripts', label: 'Scripts' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'analytics', label: 'Analytics' },
];

const PERSONAL_EXTRA: Array<{ key: SectionKey; label: string }> = [
  { key: 'affiliate', label: 'Affiliate Marketing' },
  { key: 'pr', label: 'PR' },
];

const PIPELINE_COLUMNS: Array<{ key: PipelineStatus; label: string }> = [
  { key: 'idea', label: 'Idea' },
  { key: 'scripted', label: 'Scripted' },
  { key: 'filmed', label: 'Filmed' },
  { key: 'edited', label: 'Edited' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'posted', label: 'Posted' },
];

const PLATFORMS: Platform[] = ['tiktok', 'instagram', 'youtube', 'pinterest', 'facebook'];
const DRAFT_FILTERS: Array<{ key: DraftFilter; label: string }> = [
  { key: 'all', label: 'All Drafts' },
  { key: 'filmed', label: 'Filmed' },
  { key: 'edited', label: 'Edited' },
  { key: 'scheduled', label: 'Scheduled' },
];

function statusPill(label: string, value: number) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-[#B9B4D9]">{label}</p>
      <p className="mt-2 font-sans text-2xl text-[#F8F4FF]">{value}</p>
    </div>
  );
}

function platformBadge(platform: Platform) {
  const base = 'rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em]';
  if (platform === 'tiktok') return `${base} border-[#FF3EA566] bg-[#FF3EA522] text-[#FFD2EA]`;
  if (platform === 'instagram') return `${base} border-[#C084FC66] bg-[#C084FC22] text-[#E3CCFF]`;
  if (platform === 'youtube') return `${base} border-[#ff5c6c66] bg-[#ff5c6c22] text-[#FFD0D6]`;
  if (platform === 'pinterest') return `${base} border-[#ff7aab66] bg-[#ff7aab22] text-[#FFD1E4]`;
  return `${base} border-[#7ea6ff66] bg-[#7ea6ff22] text-[#D6E3FF]`;
}

function statusBadge(status: PipelineStatus) {
  const base = 'rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em]';
  if (status === 'posted') return `${base} border-[#47d58c66] bg-[#47d58c22] text-[#BAF7D4]`;
  if (status === 'scheduled') return `${base} border-[#C084FC66] bg-[#C084FC22] text-[#E3CCFF]`;
  if (status === 'idea') return `${base} border-white/20 bg-white/10 text-[#B9B4D9]`;
  return `${base} border-[#FF3EA566] bg-[#FF3EA522] text-[#FFD2EA]`;
}

function DraggableCard({
  item,
  onEdit,
  onDelete,
}: {
  item: ContentItem;
  onEdit: (item: ContentItem) => void;
  onDelete: (id: number) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `content-${item.id}`,
    data: { itemId: item.id, status: item.status, item },
  });

  const style = { transform: CSS.Translate.toString(transform) };

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rounded-xl border border-white/10 bg-black/30 p-2.5 transition-all duration-150 ${
        isDragging ? 'opacity-60' : 'hover:-translate-y-[1px] hover:shadow-[0_0_20px_rgba(255,62,165,0.15)]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 flex-1 font-sans text-xs text-[#F8F4FF]">{item.title}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit(item);
            }}
            className="rounded-md border border-white/15 px-1.5 py-0.5 text-[10px] text-[#F8F4FF]"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void onDelete(item.id);
            }}
            className="rounded-md border border-white/15 px-1.5 py-0.5 text-[10px] text-[#ff9acb]"
          >
            Del
          </button>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className={platformBadge(item.platform)}>{item.platform}</span>
        <span className={statusBadge(item.status)}>{item.status}</span>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <p className="truncate font-sans text-[11px] text-[#B9B4D9]">{item.category || 'No category'}</p>
        <div className="flex items-center gap-1">
          <span className={`text-[11px] ${item.monetized ? 'text-[#FF3EA5]' : 'text-[#615b85]'}`}>$</span>
          <span className={`text-[11px] ${item.script_id ? 'text-[#C084FC]' : 'text-[#615b85]'}`}>📝</span>
        </div>
      </div>
    </article>
  );
}

function DroppableColumn({
  status,
  label,
  items,
  onEdit,
  onDelete,
}: {
  status: PipelineStatus;
  label: string;
  items: ContentItem[];
  onEdit: (item: ContentItem) => void;
  onDelete: (id: number) => Promise<void>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      className={`min-h-0 rounded-2xl border p-2.5 ${
        isOver ? 'border-[#FF3EA566] bg-[#FF3EA514]' : 'border-white/10 bg-black/20'
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <h4 className="font-sans text-[11px] uppercase tracking-[0.12em] text-[#F8F4FF]">{label}</h4>
        <span className="rounded-full border border-white/20 px-2 py-0.5 font-sans text-[10px] text-[#B9B4D9]">
          {items.length}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <DraggableCard key={item.id} item={item} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </section>
  );
}

function formatScriptPreview(script: ScriptItem) {
  return script.hook_lines.slice(0, 2).join(' • ') || 'No hooks yet';
}

function toLocalInputDateTime(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

function displayDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function toMonthKey(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function buildMonthGrid(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(day);
  }
  return days;
}

function toDayKey(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function prettyDayHeader(dayKey: string) {
  const date = new Date(`${dayKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dayKey;
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
}

export function ContentWorld() {
  const [brandKey, setBrandKey] = useState<BrandKey>('personal');
  const [activeSection, setActiveSection] = useState<SectionKey>('pipeline');
  const [summary, setSummary] = useState<ContentSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [items, setItems] = useState<ContentItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [activeDragItem, setActiveDragItem] = useState<ContentItem | null>(null);

  const [scripts, setScripts] = useState<ScriptItem[]>([]);
  const [scriptsLoading, setScriptsLoading] = useState(false);
  const [scriptSearch, setScriptSearch] = useState('');
  const [scriptPlatformFilter, setScriptPlatformFilter] = useState('all');

  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [draftFilter, setDraftFilter] = useState<DraftFilter>('all');

  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => toMonthKey(new Date()));
  const [calendarPlatformFilter, setCalendarPlatformFilter] = useState<'all' | Platform>('all');
  const [calendarSelectedDay, setCalendarSelectedDay] = useState<string | null>(null);
  const [calendarReschedule, setCalendarReschedule] = useState<{ id: number; title: string } | null>(null);
  const [calendarRescheduleInput, setCalendarRescheduleInput] = useState(toLocalInputDateTime());

  const [analyticsItems, setAnalyticsItems] = useState<AnalyticsItem[]>([]);
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [metricsModal, setMetricsModal] = useState<{ id: number; title: string } | null>(null);
  const [metricsForm, setMetricsForm] = useState({
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    revenue: 0,
  });

  const [affiliateLinks, setAffiliateLinks] = useState<AffiliateLink[]>([]);
  const [affiliateEarnings, setAffiliateEarnings] = useState<AffiliateEarning[]>([]);
  const [affiliateSummary, setAffiliateSummary] = useState<AffiliateSummary | null>(null);
  const [affiliateLoading, setAffiliateLoading] = useState(false);
  const [affiliateForm, setAffiliateForm] = useState({
    network: '',
    product_name: '',
    url: '',
    commission_percent: '',
  });
  const [editingAffiliateLinkId, setEditingAffiliateLinkId] = useState<number | null>(null);
  const [earningForm, setEarningForm] = useState({
    affiliate_id: '',
    content_item_id: '',
    amount: '',
    earned_date: new Date().toISOString().slice(0, 10),
  });
  const [editingEarningId, setEditingEarningId] = useState<number | null>(null);
  const [attachAffiliateId, setAttachAffiliateId] = useState('');
  const [attachScriptId, setAttachScriptId] = useState('');
  const [attachContentId, setAttachContentId] = useState('');

  const [prBrands, setPrBrands] = useState<PrBrand[]>([]);
  const [prDeliverables, setPrDeliverables] = useState<PrDeliverable[]>([]);
  const [prSummary, setPrSummary] = useState<{ pending_count: number; paid_count: number; total_pr_revenue: number } | null>(null);
  const [prLoading, setPrLoading] = useState(false);
  const [prBrandForm, setPrBrandForm] = useState({
    company_name: '',
    contact_email: '',
    contact_person: '',
    status: 'pitched',
    notes: '',
  });
  const [editingPrBrandId, setEditingPrBrandId] = useState<number | null>(null);
  const [prDeliverableForm, setPrDeliverableForm] = useState({
    pr_brand_id: '',
    content_item_id: '',
    deadline: '',
    payment_amount: '',
    status: 'pending',
  });
  const [editingPrDeliverableId, setEditingPrDeliverableId] = useState<number | null>(null);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formPlatform, setFormPlatform] = useState<Platform>('tiktok');
  const [formCategory, setFormCategory] = useState('');
  const [formStatus, setFormStatus] = useState<PipelineStatus>('idea');
  const [formMonetized, setFormMonetized] = useState(false);

  const [scriptModalOpen, setScriptModalOpen] = useState(false);
  const [editingScriptId, setEditingScriptId] = useState<number | null>(null);
  const [scriptTitle, setScriptTitle] = useState('');
  const [scriptPlatform, setScriptPlatform] = useState<Platform>('tiktok');
  const [scriptCategory, setScriptCategory] = useState('');
  const [scriptMonetized, setScriptMonetized] = useState(false);
  const [scriptHookLines, setScriptHookLines] = useState<string[]>(['', '', '']);
  const [scriptBody, setScriptBody] = useState('');
  const [scriptCta, setScriptCta] = useState('');
  const [scriptHashtags, setScriptHashtags] = useState('');

  const [logFilmedModalOpen, setLogFilmedModalOpen] = useState(false);
  const [logFilmedTitle, setLogFilmedTitle] = useState('');
  const [logFilmedPlatform, setLogFilmedPlatform] = useState<Platform>('tiktok');
  const [logFilmedCategory, setLogFilmedCategory] = useState('');
  const [logFilmedDescription, setLogFilmedDescription] = useState('');
  const [logFilmedScriptId, setLogFilmedScriptId] = useState('');
  const [logFilmedMonetized, setLogFilmedMonetized] = useState(false);
  const [logFilmedThumbnailPath, setLogFilmedThumbnailPath] = useState<string | null>(null);
  const [logFilmedUploading, setLogFilmedUploading] = useState(false);

  const [scheduleModal, setScheduleModal] = useState<{ id: number; title: string } | null>(null);
  const [scheduledAtInput, setScheduledAtInput] = useState(toLocalInputDateTime());

  const [postModal, setPostModal] = useState<{ id: number; title: string } | null>(null);
  const [postedAtInput, setPostedAtInput] = useState(toLocalInputDateTime());

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const navItems = useMemo(
    () => (brandKey === 'personal' ? [...SHARED_NAV, ...PERSONAL_EXTRA] : SHARED_NAV),
    [brandKey],
  );

  useEffect(() => {
    if (!navItems.some((item) => item.key === activeSection)) {
      setActiveSection('pipeline');
    }
  }, [activeSection, navItems]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.category) set.add(item.category);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const loadSummary = async (nextBrandKey = brandKey) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/content/summary?brand_key=${nextBrandKey}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('summary_failed');
      const payload = (await response.json()) as ContentSummary;
      setSummary(payload);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async (
    brandId: number,
    opts?: { nextSearch?: string; nextPlatform?: string; nextCategory?: string },
  ) => {
    setItemsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('brand_id', String(brandId));
      const q = opts?.nextSearch ?? search;
      const p = opts?.nextPlatform ?? platformFilter;
      const c = opts?.nextCategory ?? categoryFilter;
      if (q.trim()) params.set('q', q.trim());
      if (p !== 'all') params.set('platform', p);
      if (c !== 'all') params.set('category', c);

      const response = await fetch(`/api/content/items?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('items_failed');
      const payload = (await response.json()) as ContentItem[];
      setItems(Array.isArray(payload) ? payload : []);
    } catch {
      setItems([]);
    } finally {
      setItemsLoading(false);
    }
  };

  const loadScripts = async (brandId: number, opts?: { nextSearch?: string; nextPlatform?: string }) => {
    setScriptsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('brand_id', String(brandId));
      const q = opts?.nextSearch ?? scriptSearch;
      const p = opts?.nextPlatform ?? scriptPlatformFilter;
      if (q.trim()) params.set('q', q.trim());
      if (p !== 'all') params.set('platform', p);

      const response = await fetch(`/api/content/scripts?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('scripts_failed');
      const payload = (await response.json()) as ScriptItem[];
      setScripts(Array.isArray(payload) ? payload : []);
    } catch {
      setScripts([]);
    } finally {
      setScriptsLoading(false);
    }
  };

  const loadDrafts = async (brandId: number, nextStatus = draftFilter) => {
    setDraftsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('brand_id', String(brandId));
      params.set('status', nextStatus);
      const response = await fetch(`/api/content/drafts?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('drafts_failed');
      const payload = (await response.json()) as DraftItem[];
      setDrafts(Array.isArray(payload) ? payload : []);
    } catch {
      setDrafts([]);
    } finally {
      setDraftsLoading(false);
    }
  };

  const loadCalendar = async (brandId: number, month = calendarMonth) => {
    setCalendarLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('brand_id', String(brandId));
      params.set('month', month);
      const response = await fetch(`/api/content/calendar?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('calendar_failed');
      const payload = (await response.json()) as CalendarItem[];
      setCalendarItems(Array.isArray(payload) ? payload : []);
    } catch {
      setCalendarItems([]);
    } finally {
      setCalendarLoading(false);
    }
  };

  const loadAnalytics = async (brandId: number) => {
    setAnalyticsLoading(true);
    try {
      const response = await fetch(`/api/content/analytics?brand_id=${brandId}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('analytics_failed');
      const payload = (await response.json()) as { items: AnalyticsItem[]; summary: AnalyticsSummary };
      setAnalyticsItems(Array.isArray(payload.items) ? payload.items : []);
      setAnalyticsSummary(payload.summary ?? null);
    } catch {
      setAnalyticsItems([]);
      setAnalyticsSummary(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadAffiliate = async (brandId: number) => {
    setAffiliateLoading(true);
    try {
      const [linksRes, earningsRes, summaryRes] = await Promise.all([
        fetch(`/api/content/affiliate/links?brand_id=${brandId}`, { cache: 'no-store' }),
        fetch(`/api/content/affiliate/earnings?brand_id=${brandId}`, { cache: 'no-store' }),
        fetch(`/api/content/affiliate/summary?brand_id=${brandId}`, { cache: 'no-store' }),
      ]);
      const linksPayload = linksRes.ok ? ((await linksRes.json()) as AffiliateLink[]) : [];
      const earningsPayload = earningsRes.ok ? ((await earningsRes.json()) as AffiliateEarning[]) : [];
      const summaryPayload = summaryRes.ok ? ((await summaryRes.json()) as AffiliateSummary) : null;
      setAffiliateLinks(Array.isArray(linksPayload) ? linksPayload : []);
      setAffiliateEarnings(Array.isArray(earningsPayload) ? earningsPayload : []);
      setAffiliateSummary(summaryPayload);
    } catch {
      setAffiliateLinks([]);
      setAffiliateEarnings([]);
      setAffiliateSummary(null);
    } finally {
      setAffiliateLoading(false);
    }
  };

  const loadPR = async (brandId: number) => {
    setPrLoading(true);
    try {
      const [brandsRes, deliverablesRes, summaryRes] = await Promise.all([
        fetch(`/api/content/pr/brands?brand_id=${brandId}`, { cache: 'no-store' }),
        fetch(`/api/content/pr/deliverables?brand_id=${brandId}`, { cache: 'no-store' }),
        fetch(`/api/content/pr/summary?brand_id=${brandId}`, { cache: 'no-store' }),
      ]);
      setPrBrands(brandsRes.ok ? ((await brandsRes.json()) as PrBrand[]) : []);
      setPrDeliverables(deliverablesRes.ok ? ((await deliverablesRes.json()) as PrDeliverable[]) : []);
      setPrSummary(summaryRes.ok ? ((await summaryRes.json()) as { pending_count: number; paid_count: number; total_pr_revenue: number }) : null);
    } catch {
      setPrBrands([]);
      setPrDeliverables([]);
      setPrSummary(null);
    } finally {
      setPrLoading(false);
    }
  };

  useEffect(() => {
    const stored = window.localStorage.getItem('content_brand_key');
    if (stored === 'personal' || stored === 'business') setBrandKey(stored);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('content_brand_key', brandKey);
    void loadSummary(brandKey);
  }, [brandKey]);

  useEffect(() => {
    if (!summary?.brand.id) return;

    const timer = setTimeout(() => {
      if (activeSection === 'scripts') {
        void loadScripts(summary.brand.id);
      } else if (activeSection === 'drafts') {
        void loadDrafts(summary.brand.id);
      } else if (activeSection === 'calendar') {
        void loadCalendar(summary.brand.id);
      } else if (activeSection === 'analytics') {
        void loadAnalytics(summary.brand.id);
      } else if (activeSection === 'affiliate') {
        void Promise.all([loadAffiliate(summary.brand.id), loadScripts(summary.brand.id), loadItems(summary.brand.id)]);
      } else if (activeSection === 'pr') {
        void Promise.all([loadPR(summary.brand.id), loadItems(summary.brand.id)]);
      } else if (activeSection === 'pipeline') {
        void loadItems(summary.brand.id);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [
    summary?.brand.id,
    activeSection,
    search,
    platformFilter,
    categoryFilter,
    scriptSearch,
    scriptPlatformFilter,
    draftFilter,
    calendarMonth,
  ]);

  const openCreateModal = () => {
    setEditingItemId(null);
    setFormTitle('');
    setFormPlatform('tiktok');
    setFormCategory('');
    setFormStatus('idea');
    setFormMonetized(false);
    setItemModalOpen(true);
  };

  const openEditModal = (item: ContentItem) => {
    setEditingItemId(item.id);
    setFormTitle(item.title);
    setFormPlatform(item.platform);
    setFormCategory(item.category ?? '');
    setFormStatus(item.status);
    setFormMonetized(Boolean(item.monetized));
    setItemModalOpen(true);
  };

  const saveItem = async () => {
    if (!summary?.brand.id || !formTitle.trim()) return;

    if (editingItemId) {
      await fetch(`/api/content/items/${editingItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: summary.brand.id,
          title: formTitle.trim(),
          platform: formPlatform,
          category: formCategory.trim() || null,
          status: formStatus,
          monetized: formMonetized,
        }),
      });
    } else {
      await fetch('/api/content/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: summary.brand.id,
          title: formTitle.trim(),
          platform: formPlatform,
          category: formCategory.trim() || null,
          status: 'idea',
          monetized: formMonetized,
        }),
      });
    }

    setItemModalOpen(false);
    await loadItems(summary.brand.id);
    await loadSummary();
  };

  const deleteItem = async (id: number) => {
    if (!summary?.brand.id) return;
    await fetch(`/api/content/items/${id}?brand_id=${summary.brand.id}`, { method: 'DELETE' });
    await loadItems(summary.brand.id);
    await loadSummary();
  };

  const onDragStart = (event: DragStartEvent) => {
    const item = event.active.data.current?.item as ContentItem | undefined;
    setActiveDragItem(item ?? null);
  };

  const onDragEnd = async (event: DragEndEvent) => {
    setActiveDragItem(null);
    if (!summary?.brand.id) return;
    const overStatus = event.over?.id as PipelineStatus | undefined;
    const itemId = event.active.data.current?.itemId as number | undefined;
    const fromStatus = event.active.data.current?.status as PipelineStatus | undefined;
    if (!itemId || !overStatus || !fromStatus || overStatus === fromStatus) return;

    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, status: overStatus } : item)));

    const response = await fetch(`/api/content/items/${itemId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_id: summary.brand.id, status: overStatus }),
    });

    if (!response.ok) {
      setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, status: fromStatus } : item)));
      return;
    }

    await loadSummary();
  };

  const resetScriptForm = () => {
    setEditingScriptId(null);
    setScriptTitle('');
    setScriptPlatform('tiktok');
    setScriptCategory('');
    setScriptMonetized(false);
    setScriptHookLines(['', '', '']);
    setScriptBody('');
    setScriptCta('');
    setScriptHashtags('');
  };

  const openNewScriptModal = () => {
    resetScriptForm();
    setScriptModalOpen(true);
  };

  const openEditScriptModal = (script: ScriptItem) => {
    setEditingScriptId(script.id);
    setScriptTitle(script.title);
    setScriptPlatform(script.platform);
    setScriptCategory(script.category ?? '');
    setScriptMonetized(Boolean(script.monetized));
    setScriptHookLines(script.hook_lines.length ? script.hook_lines.slice(0, 6) : ['', '', '']);
    setScriptBody(script.body);
    setScriptCta(script.cta ?? '');
    setScriptHashtags(script.hashtags ?? '');
    setScriptModalOpen(true);
  };

  const persistScript = async () => {
    if (!summary?.brand.id) return null;
    const title = scriptTitle.trim();
    const body = scriptBody.trim();
    const hookLines = scriptHookLines.map((line) => line.trim()).filter(Boolean).slice(0, 6);
    if (!title || !body || hookLines.length < 3) return null;

    if (editingScriptId) {
      const response = await fetch(`/api/content/scripts/${editingScriptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: summary.brand.id,
          title,
          platform: scriptPlatform,
          category: scriptCategory.trim() || null,
          monetized: scriptMonetized,
          hook_lines: hookLines,
          body,
          cta: scriptCta.trim() || null,
          hashtags: scriptHashtags.trim() || null,
        }),
      });
      if (!response.ok) return null;
      await loadScripts(summary.brand.id);
      return editingScriptId;
    }

    const response = await fetch('/api/content/scripts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand_id: summary.brand.id,
        title,
        platform: scriptPlatform,
        category: scriptCategory.trim() || null,
        monetized: scriptMonetized,
        hook_lines: hookLines,
        body,
        cta: scriptCta.trim() || null,
        hashtags: scriptHashtags.trim() || null,
      }),
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as { insertedId?: number };
    await loadScripts(summary.brand.id);
    return payload.insertedId ?? null;
  };

  const saveScript = async () => {
    const scriptId = await persistScript();
    if (!scriptId) return;
    setEditingScriptId(scriptId);
    setScriptModalOpen(false);
  };

  const convertScript = async (id: number) => {
    if (!summary?.brand.id) return;
    await fetch(`/api/content/scripts/${id}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_id: summary.brand.id }),
    });
    await Promise.all([loadSummary(), loadItems(summary.brand.id)]);
  };

  const saveAndConvertScript = async () => {
    const scriptId = await persistScript();
    if (!scriptId) return;
    await convertScript(scriptId);
    setScriptModalOpen(false);
    setActiveSection('pipeline');
  };

  const deleteScript = async (id: number) => {
    if (!summary?.brand.id) return;
    await fetch(`/api/content/scripts/${id}?brand_id=${summary.brand.id}`, { method: 'DELETE' });
    await loadScripts(summary.brand.id);
  };

  const resetLogFilmedForm = () => {
    setLogFilmedTitle('');
    setLogFilmedPlatform('tiktok');
    setLogFilmedCategory('');
    setLogFilmedDescription('');
    setLogFilmedScriptId('');
    setLogFilmedMonetized(false);
    setLogFilmedThumbnailPath(null);
  };

  const uploadDraftThumbnail = async (file: File) => {
    setLogFilmedUploading(true);
    try {
      const formData = new FormData();
      formData.set('file', file);
      const response = await fetch('/api/content/upload', { method: 'POST', body: formData });
      if (!response.ok) return;
      const payload = (await response.json()) as { image_path?: string };
      if (payload.image_path) setLogFilmedThumbnailPath(payload.image_path);
    } finally {
      setLogFilmedUploading(false);
    }
  };

  const saveFilmedDraft = async () => {
    if (!summary?.brand.id || !logFilmedTitle.trim()) return;
    const response = await fetch('/api/content/log-filmed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand_id: summary.brand.id,
        title: logFilmedTitle.trim(),
        platform: logFilmedPlatform,
        category: logFilmedCategory.trim() || null,
        description: logFilmedDescription.trim() || null,
        script_id: logFilmedScriptId ? Number(logFilmedScriptId) : null,
        thumbnail_path: logFilmedThumbnailPath,
        monetized: logFilmedMonetized,
      }),
    });
    if (!response.ok) return;

    setLogFilmedModalOpen(false);
    resetLogFilmedForm();
    await Promise.all([loadSummary(), loadDrafts(summary.brand.id)]);
  };

  const markDraftEdited = async (id: number) => {
    if (!summary?.brand.id) return;
    await fetch(`/api/content/items/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_id: summary.brand.id, status: 'edited' }),
    });
    await Promise.all([loadSummary(), loadDrafts(summary.brand.id)]);
  };

  const openScheduleModal = (id: number, title: string) => {
    setScheduledAtInput(toLocalInputDateTime());
    setScheduleModal({ id, title });
  };

  const scheduleDraft = async () => {
    if (!scheduleModal || !scheduledAtInput || !summary?.brand.id) return;
    await fetch(`/api/content/items/${scheduleModal.id}/schedule`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_id: summary.brand.id, scheduled_at: new Date(scheduledAtInput).toISOString() }),
    });
    setScheduleModal(null);
    await Promise.all([loadSummary(), loadDrafts(summary.brand.id)]);
  };

  const openPostModal = (id: number, title: string) => {
    setPostedAtInput(toLocalInputDateTime());
    setPostModal({ id, title });
  };

  const postDraft = async () => {
    if (!postModal || !postedAtInput || !summary?.brand.id) return;
    await fetch(`/api/content/items/${postModal.id}/post`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_id: summary.brand.id, posted_at: new Date(postedAtInput).toISOString() }),
    });
    setPostModal(null);
    await Promise.all([loadSummary(), loadDrafts(summary.brand.id), loadItems(summary.brand.id)]);
  };

  const filteredCalendarItems = useMemo(() => {
    if (calendarPlatformFilter === 'all') return calendarItems;
    return calendarItems.filter((item) => item.platform === calendarPlatformFilter);
  }, [calendarItems, calendarPlatformFilter]);

  const calendarItemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of filteredCalendarItems) {
      const date = new Date(item.scheduled_at);
      if (Number.isNaN(date.getTime())) continue;
      const key = toDayKey(date);
      const existing = map.get(key) ?? [];
      existing.push(item);
      map.set(key, existing);
    }
    return map;
  }, [filteredCalendarItems]);

  const monthGridDays = useMemo(() => buildMonthGrid(calendarMonth), [calendarMonth]);

  const selectedDayItems = useMemo(() => {
    if (!calendarSelectedDay) return [];
    return (calendarItemsByDay.get(calendarSelectedDay) ?? []).slice().sort((a, b) => {
      return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
    });
  }, [calendarItemsByDay, calendarSelectedDay]);

  const shiftCalendarMonth = (delta: number) => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const next = new Date(year, month - 1 + delta, 1);
    setCalendarMonth(toMonthKey(next));
    setCalendarSelectedDay(null);
  };

  const openCalendarReschedule = (item: CalendarItem) => {
    setCalendarReschedule({ id: item.id, title: item.title });
    setCalendarRescheduleInput(toLocalInputDateTime(item.scheduled_at));
  };

  const saveCalendarReschedule = async () => {
    if (!calendarReschedule || !calendarRescheduleInput || !summary?.brand.id) return;
    await fetch(`/api/content/items/${calendarReschedule.id}/schedule`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_id: summary.brand.id, scheduled_at: new Date(calendarRescheduleInput).toISOString() }),
    });
    setCalendarReschedule(null);
    await Promise.all([loadSummary(), loadCalendar(summary.brand.id)]);
  };

  const openMetricsModal = (item: AnalyticsItem) => {
    setMetricsModal({ id: item.content_item_id, title: item.title });
    setMetricsForm({
      views: item.views,
      likes: item.likes,
      comments: item.comments,
      shares: item.shares,
      saves: item.saves,
      revenue: item.revenue,
    });
  };

  const saveMetrics = async () => {
    if (!metricsModal || !summary?.brand.id) return;
    await fetch(`/api/content/metrics/${metricsModal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_id: summary.brand.id, ...metricsForm }),
    });
    setMetricsModal(null);
    await loadAnalytics(summary.brand.id);
  };

  const createAffiliateLink = async () => {
    if (!summary?.brand.id || !affiliateForm.network.trim() || !affiliateForm.product_name.trim() || !affiliateForm.url.trim()) return;
    if (editingAffiliateLinkId) {
      await fetch('/api/content/affiliate/links', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingAffiliateLinkId,
          brand_id: summary.brand.id,
          network: affiliateForm.network.trim(),
          product_name: affiliateForm.product_name.trim(),
          url: affiliateForm.url.trim(),
          commission_percent: affiliateForm.commission_percent ? Number(affiliateForm.commission_percent) : null,
        }),
      });
    } else {
      await fetch('/api/content/affiliate/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: summary.brand.id,
          network: affiliateForm.network.trim(),
          product_name: affiliateForm.product_name.trim(),
          url: affiliateForm.url.trim(),
          commission_percent: affiliateForm.commission_percent ? Number(affiliateForm.commission_percent) : null,
        }),
      });
    }
    setEditingAffiliateLinkId(null);
    setAffiliateForm({ network: '', product_name: '', url: '', commission_percent: '' });
    await loadAffiliate(summary.brand.id);
  };

  const deleteAffiliateLink = async (id: number) => {
    if (!summary?.brand.id) return;
    await fetch(`/api/content/affiliate/links?id=${id}&brand_id=${summary.brand.id}`, { method: 'DELETE' });
    await loadAffiliate(summary.brand.id);
  };

  const createAffiliateEarning = async () => {
    if (!summary?.brand.id || !earningForm.affiliate_id || !earningForm.amount || !earningForm.earned_date) return;
    if (editingEarningId) {
      await fetch('/api/content/affiliate/earnings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingEarningId,
          brand_id: summary.brand.id,
          affiliate_id: Number(earningForm.affiliate_id),
          content_item_id: earningForm.content_item_id ? Number(earningForm.content_item_id) : null,
          amount: Number(earningForm.amount),
          earned_date: earningForm.earned_date,
        }),
      });
    } else {
      await fetch('/api/content/affiliate/earnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: summary.brand.id,
          affiliate_id: Number(earningForm.affiliate_id),
          content_item_id: earningForm.content_item_id ? Number(earningForm.content_item_id) : null,
          amount: Number(earningForm.amount),
          earned_date: earningForm.earned_date,
        }),
      });
    }
    setEditingEarningId(null);
    setEarningForm({ affiliate_id: '', content_item_id: '', amount: '', earned_date: new Date().toISOString().slice(0, 10) });
    await loadAffiliate(summary.brand.id);
  };

  const deleteAffiliateEarning = async (id: number) => {
    if (!summary?.brand.id) return;
    await fetch(`/api/content/affiliate/earnings?id=${id}&brand_id=${summary.brand.id}`, { method: 'DELETE' });
    await loadAffiliate(summary.brand.id);
  };

  const attachAffiliate = async () => {
    if (!attachAffiliateId || (!attachScriptId && !attachContentId) || !summary?.brand.id) return;
    if (attachScriptId) {
      await fetch(`/api/content/scripts/${attachScriptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: summary.brand.id, affiliate_id: Number(attachAffiliateId) }),
      });
    }
    if (attachContentId) {
      await fetch(`/api/content/items/${attachContentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: summary.brand.id, affiliate_id: Number(attachAffiliateId) }),
      });
    }
    setAttachScriptId('');
    setAttachContentId('');
    await Promise.all([loadAffiliate(summary.brand.id), loadScripts(summary.brand.id), loadItems(summary.brand.id)]);
  };

  const createPrBrand = async () => {
    if (!summary?.brand.id || !prBrandForm.company_name.trim()) return;
    if (editingPrBrandId) {
      await fetch('/api/content/pr/brands', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPrBrandId,
          brand_id: summary.brand.id,
          company_name: prBrandForm.company_name.trim(),
          contact_email: prBrandForm.contact_email.trim() || null,
          contact_person: prBrandForm.contact_person.trim() || null,
          status: prBrandForm.status,
          notes: prBrandForm.notes.trim() || null,
        }),
      });
    } else {
      await fetch('/api/content/pr/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: summary.brand.id,
          company_name: prBrandForm.company_name.trim(),
          contact_email: prBrandForm.contact_email.trim() || null,
          contact_person: prBrandForm.contact_person.trim() || null,
          status: prBrandForm.status,
          notes: prBrandForm.notes.trim() || null,
        }),
      });
    }
    setEditingPrBrandId(null);
    setPrBrandForm({ company_name: '', contact_email: '', contact_person: '', status: 'pitched', notes: '' });
    await loadPR(summary.brand.id);
  };

  const deletePrBrand = async (id: number) => {
    if (!summary?.brand.id) return;
    await fetch(`/api/content/pr/brands?id=${id}&brand_id=${summary.brand.id}`, { method: 'DELETE' });
    await loadPR(summary.brand.id);
  };

  const createPrDeliverable = async () => {
    if (!summary?.brand.id || !prDeliverableForm.pr_brand_id) return;
    if (editingPrDeliverableId) {
      await fetch('/api/content/pr/deliverables', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPrDeliverableId,
          brand_id: summary.brand.id,
          pr_brand_id: Number(prDeliverableForm.pr_brand_id),
          content_item_id: prDeliverableForm.content_item_id ? Number(prDeliverableForm.content_item_id) : null,
          deadline: prDeliverableForm.deadline || null,
          payment_amount: prDeliverableForm.payment_amount ? Number(prDeliverableForm.payment_amount) : null,
          status: prDeliverableForm.status,
        }),
      });
    } else {
      await fetch('/api/content/pr/deliverables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: summary.brand.id,
          pr_brand_id: Number(prDeliverableForm.pr_brand_id),
          content_item_id: prDeliverableForm.content_item_id ? Number(prDeliverableForm.content_item_id) : null,
          deadline: prDeliverableForm.deadline || null,
          payment_amount: prDeliverableForm.payment_amount ? Number(prDeliverableForm.payment_amount) : null,
          status: prDeliverableForm.status,
        }),
      });
    }
    setEditingPrDeliverableId(null);
    setPrDeliverableForm({ pr_brand_id: '', content_item_id: '', deadline: '', payment_amount: '', status: 'pending' });
    await loadPR(summary.brand.id);
  };

  const deletePrDeliverable = async (id: number) => {
    if (!summary?.brand.id) return;
    await fetch(`/api/content/pr/deliverables?id=${id}&brand_id=${summary.brand.id}`, { method: 'DELETE' });
    await loadPR(summary.brand.id);
  };

  return (
    <BackgroundShell overlayClassName="bg-[radial-gradient(circle_at_50%_18%,rgba(255,62,165,0.10),rgba(192,132,252,0.08)_36%,rgba(8,6,24,0.84)_72%)]">
      <div className="mx-auto h-full w-full max-w-[1600px] overflow-hidden px-4 py-3 max-[900px]:px-2 max-[900px]:py-1.5">
        <div className="mb-2 flex items-center justify-between gap-2 max-[900px]:mb-1">
          <Link
            href="/"
            className="rounded-full border border-white/15 bg-black/25 px-2.5 py-1 font-sans text-[11px] text-[#B9B4D9] transition-all duration-200 hover:-translate-y-[1px] hover:text-[#F8F4FF] max-[900px]:px-2 max-[900px]:py-0.5 max-[900px]:text-[10px]"
          >
            ← Back
          </Link>

          <div className="flex items-center rounded-full border border-white/20 bg-[rgba(18,16,40,0.70)] p-1">
            <button
              type="button"
              onClick={() => setBrandKey('personal')}
              className={`rounded-full px-4 py-1.5 font-sans text-xs transition-all max-[900px]:px-2 max-[900px]:py-1 max-[900px]:text-[11px] ${
                brandKey === 'personal' ? 'bg-[#FF3EA522] text-[#F8F4FF]' : 'text-[#B9B4D9]'
              }`}
            >
              Personal Brand
            </button>
            <button
              type="button"
              onClick={() => setBrandKey('business')}
              className={`rounded-full px-4 py-1.5 font-sans text-xs transition-all max-[900px]:px-2 max-[900px]:py-1 max-[900px]:text-[11px] ${
                brandKey === 'business' ? 'bg-[#FF3EA522] text-[#F8F4FF]' : 'text-[#B9B4D9]'
              }`}
            >
              Business Brand
            </button>
          </div>

          <div className="text-right">
            <h1 className="font-serif text-4xl text-[#F8F4FF] max-[900px]:text-xl">Content World</h1>
            <p className="font-sans text-xs text-[#B9B4D9] max-[900px]:text-[10px]">Creative Operations Hub</p>
          </div>
        </div>

        <div className="grid h-full grid-cols-[18%_57%_25%] gap-3 overflow-hidden max-[900px]:grid-cols-[17%_58%_25%] max-[900px]:gap-1.5">
          <aside className="rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.60)] p-3 backdrop-blur-xl max-[900px]:p-1.5">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = item.key === activeSection;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveSection(item.key)}
                    className={`group relative flex w-full items-center rounded-xl px-3 py-2.5 text-left font-sans text-sm transition-all duration-200 max-[900px]:px-1.5 max-[900px]:py-1.25 max-[900px]:text-[11px] ${
                      isActive ? 'bg-white/10 text-[#F8F4FF]' : 'text-[#B9B4D9] hover:bg-white/5 hover:text-[#F8F4FF]'
                    }`}
                  >
                    <span
                      className={`absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[#FF3EA5] transition-opacity ${
                        isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
                      }`}
                    />
                    <span className="pl-2">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="min-h-0 rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.60)] p-3 backdrop-blur-xl max-[900px]:p-2">
            {activeSection === 'pipeline' && (
              <>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="font-serif text-3xl text-[#F8F4FF] max-[840px]:text-xl">Pipeline</h2>
                  <span className="rounded-full border border-[#C084FC66] bg-[#C084FC1A] px-3 py-1 font-sans text-xs text-[#C084FC]">
                    {summary?.brand.name ?? (brandKey === 'personal' ? 'Personal Brand' : 'Business Brand')}
                  </span>
                </div>

                <div className="mb-3 flex items-center gap-2 max-[840px]:mb-2">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search title, hook, category..."
                    className="h-10 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 font-sans text-sm text-[#F8F4FF] outline-none placeholder:text-[#B9B4D9] max-[840px]:h-8 max-[840px]:text-xs"
                  />
                  <select
                    value={platformFilter}
                    onChange={(event) => setPlatformFilter(event.target.value)}
                    className="h-10 rounded-xl border border-white/10 bg-black/25 px-3 font-sans text-sm text-[#F8F4FF] max-[840px]:h-8 max-[840px]:px-2 max-[840px]:text-xs"
                  >
                    <option value="all">All platforms</option>
                    {PLATFORMS.map((platform) => (
                      <option key={platform} value={platform}>
                        {platform}
                      </option>
                    ))}
                  </select>
                  <select
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                    className="h-10 rounded-xl border border-white/10 bg-black/25 px-3 font-sans text-sm text-[#F8F4FF] max-[840px]:h-8 max-[840px]:px-2 max-[840px]:text-xs"
                  >
                    <option value="all">All categories</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="h-10 rounded-xl border border-[#FF3EA566] bg-[#FF3EA522] px-4 font-sans text-sm text-[#F8F4FF] max-[840px]:h-8 max-[840px]:px-3 max-[840px]:text-xs"
                  >
                    + New Item
                  </button>
                </div>

                {loading ? (
                  <div className="grid grid-cols-3 gap-3">
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <div key={idx} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
                    ))}
                  </div>
                ) : (
                  <div className="grid h-[calc(100%-5.5rem)] grid-rows-[auto_1fr] gap-3 overflow-hidden max-[840px]:gap-2">
                    <div className="grid grid-cols-3 gap-3 max-[840px]:grid-cols-2 max-[840px]:gap-2">
                      {statusPill('Ideas', summary?.countsByStatus.idea ?? 0)}
                      {statusPill('Scripted', summary?.countsByStatus.scripted ?? 0)}
                      {statusPill('Filmed', summary?.countsByStatus.filmed ?? 0)}
                      {statusPill('Edited', summary?.countsByStatus.edited ?? 0)}
                      {statusPill('Scheduled', summary?.countsByStatus.scheduled ?? 0)}
                      {statusPill('Posted', summary?.countsByStatus.posted ?? 0)}
                    </div>

                    <section className="min-h-0 rounded-2xl border border-white/10 bg-black/20 p-2.5">
                      {itemsLoading ? (
                          <div className="grid h-full grid-cols-6 gap-2 max-[840px]:grid-cols-3">
                          {Array.from({ length: 6 }).map((_, idx) => (
                            <div key={idx} className="rounded-2xl border border-white/10 bg-white/5" />
                          ))}
                        </div>
                      ) : (
                        <DndContext
                          sensors={sensors}
                          onDragStart={onDragStart}
                          onDragEnd={(event) => void onDragEnd(event)}
                        >
                          <div className="grid h-full min-w-[780px] grid-cols-6 gap-2 overflow-x-auto">
                            {PIPELINE_COLUMNS.map((column) => (
                              <DroppableColumn
                                key={column.key}
                                status={column.key}
                                label={column.label}
                                items={items.filter((item) => item.status === column.key)}
                                onEdit={openEditModal}
                                onDelete={deleteItem}
                              />
                            ))}
                          </div>
                          <DragOverlay>
                            {activeDragItem ? (
                              <div className="w-[220px] rounded-xl border border-white/10 bg-black/45 p-2.5 opacity-75">
                                <p className="font-sans text-xs text-[#F8F4FF]">{activeDragItem.title}</p>
                                <div className="mt-2 flex items-center gap-1.5">
                                  <span className={platformBadge(activeDragItem.platform)}>{activeDragItem.platform}</span>
                                  <span className={statusBadge(activeDragItem.status)}>{activeDragItem.status}</span>
                                </div>
                              </div>
                            ) : null}
                          </DragOverlay>
                        </DndContext>
                      )}
                    </section>
                  </div>
                )}
              </>
            )}

            {activeSection === 'scripts' && (
              <>
                <div className="mb-3 flex items-center justify-between gap-2 max-[840px]:mb-2">
                  <h2 className="font-serif text-3xl text-[#F8F4FF] max-[840px]:text-xl">Scripts</h2>
                  <button
                    type="button"
                    onClick={openNewScriptModal}
                    className="h-10 rounded-xl border border-[#FF3EA566] bg-[#FF3EA522] px-4 font-sans text-sm text-[#F8F4FF] max-[840px]:h-8 max-[840px]:px-3 max-[840px]:text-xs"
                  >
                    + New Script
                  </button>
                </div>

                <div className="mb-3 flex items-center gap-2">
                  <input
                    value={scriptSearch}
                    onChange={(event) => setScriptSearch(event.target.value)}
                    placeholder="Search script title, body, hashtags..."
                    className="h-10 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 font-sans text-sm text-[#F8F4FF] outline-none placeholder:text-[#B9B4D9] max-[840px]:h-8 max-[840px]:text-xs"
                  />
                  <select
                    value={scriptPlatformFilter}
                    onChange={(event) => setScriptPlatformFilter(event.target.value)}
                    className="h-10 rounded-xl border border-white/10 bg-black/25 px-3 font-sans text-sm text-[#F8F4FF] max-[840px]:h-8 max-[840px]:text-xs"
                  >
                    <option value="all">All platforms</option>
                    {PLATFORMS.map((platform) => (
                      <option key={platform} value={platform}>
                        {platform}
                      </option>
                    ))}
                  </select>
                </div>

                <section className="h-[calc(100%-5.8rem)] overflow-y-auto pr-1">
                  {scriptsLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <div key={idx} className="h-20 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
                      ))}
                    </div>
                  ) : scripts.length === 0 ? (
                    <div className="grid h-full place-items-center rounded-2xl border border-white/10 bg-black/20">
                      <p className="font-sans text-sm text-[#B9B4D9]">No scripts yet for this brand.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {scripts.map((script) => (
                        <article key={script.id} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-sans text-sm text-[#F8F4FF]">{script.title}</h3>
                              <div className="mt-1 flex items-center gap-1.5">
                                <span className={platformBadge(script.platform)}>{script.platform}</span>
                                <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-[#B9B4D9]">
                                  {script.category || 'No category'}
                                </span>
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[10px] ${
                                    script.monetized
                                      ? 'border-[#FF3EA566] bg-[#FF3EA522] text-[#FFD2EA]'
                                      : 'border-white/15 text-[#B9B4D9]'
                                  }`}
                                >
                                  {script.monetized ? 'Monetized' : 'Organic'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditScriptModal(script)}
                                className="rounded-md border border-white/15 px-2 py-1 text-[11px] text-[#F8F4FF]"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void convertScript(script.id)}
                                className="rounded-md border border-[#C084FC66] bg-[#C084FC1F] px-2 py-1 text-[11px] text-[#E3CCFF]"
                              >
                                Convert
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteScript(script.id)}
                                className="rounded-md border border-white/15 px-2 py-1 text-[11px] text-[#ff9acb]"
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          <p className="mt-2 line-clamp-1 font-sans text-xs text-[#B9B4D9]">{formatScriptPreview(script)}</p>
                          <p className="mt-1 line-clamp-2 font-sans text-xs text-[#A9A4C8]">{script.body}</p>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}

            {activeSection === 'drafts' && (
              <>
                <div className="mb-3 flex items-center justify-between gap-2 max-[840px]:mb-2">
                  <h2 className="font-serif text-3xl text-[#F8F4FF] max-[840px]:text-xl">Drafts</h2>
                  <button
                    type="button"
                    onClick={() => {
                      resetLogFilmedForm();
                      if (summary?.brand.id) void loadScripts(summary.brand.id);
                      setLogFilmedModalOpen(true);
                    }}
                    className="h-10 rounded-xl border border-[#FF3EA566] bg-[#FF3EA522] px-4 font-sans text-sm text-[#F8F4FF] max-[840px]:h-8 max-[840px]:px-3 max-[840px]:text-xs"
                  >
                    + Log Filmed Content
                  </button>
                </div>

                <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
                  {DRAFT_FILTERS.map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => setDraftFilter(filter.key)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        draftFilter === filter.key
                          ? 'border-[#FF3EA566] bg-[#FF3EA522] text-[#F8F4FF]'
                          : 'border-white/20 bg-black/20 text-[#B9B4D9]'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                <section className="h-[calc(100%-5.8rem)] overflow-y-auto pr-1">
                  {draftsLoading ? (
                    <div className="grid grid-cols-3 gap-2 max-[840px]:grid-cols-2">
                      {Array.from({ length: 9 }).map((_, idx) => (
                        <div key={idx} className="h-36 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
                      ))}
                    </div>
                  ) : drafts.length === 0 ? (
                    <div className="grid h-full place-items-center rounded-2xl border border-white/10 bg-black/20">
                      <p className="font-sans text-sm text-[#B9B4D9]">No drafts for this filter.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 max-[840px]:grid-cols-2">
                      {drafts.map((draft) => (
                        <article key={draft.id} className="overflow-hidden rounded-2xl border border-white/10 bg-black/25">
                          <div className="h-28 w-full bg-black/40">
                            {draft.thumbnail_path ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={draft.thumbnail_path}
                                alt={draft.title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="grid h-full place-items-center text-xs text-[#B9B4D9]">No thumbnail</div>
                            )}
                          </div>
                          <div className="space-y-2 p-2.5">
                            <div className="flex items-center justify-between gap-1">
                              <p className="line-clamp-1 font-sans text-xs text-[#F8F4FF]">{draft.title}</p>
                              <span className={statusBadge(draft.status)}>{draft.status}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={platformBadge(draft.platform)}>{draft.platform}</span>
                              <span className="truncate text-[10px] text-[#B9B4D9]">{draft.category || 'No category'}</span>
                            </div>
                            <p className="line-clamp-1 text-[10px] text-[#9b96ba]">
                              {draft.status === 'scheduled'
                                ? `Scheduled: ${displayDateTime(draft.scheduled_at)}`
                                : `Filmed: ${displayDateTime(draft.filmed_at)}`}
                            </p>
                            <div className="grid grid-cols-2 gap-1">
                              <button
                                type="button"
                                onClick={() => void markDraftEdited(draft.id)}
                                className="rounded-md border border-white/15 px-2 py-1 text-[10px] text-[#F8F4FF]"
                              >
                                Mark Edited
                              </button>
                              <button
                                type="button"
                                onClick={() => openScheduleModal(draft.id, draft.title)}
                                className="rounded-md border border-[#C084FC66] bg-[#C084FC1F] px-2 py-1 text-[10px] text-[#E3CCFF]"
                              >
                                Schedule
                              </button>
                              <button
                                type="button"
                                onClick={() => openPostModal(draft.id, draft.title)}
                                className="rounded-md border border-[#47d58c66] bg-[#47d58c1f] px-2 py-1 text-[10px] text-[#c6f7dd]"
                              >
                                Mark Posted
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveSection('pipeline')}
                                className="rounded-md border border-white/15 px-2 py-1 text-[10px] text-[#B9B4D9]"
                              >
                                Open Pipeline
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}

            {activeSection === 'calendar' && (
              <>
                <div className="mb-3 flex items-center justify-between gap-2 max-[840px]:mb-2">
                  <h2 className="font-serif text-3xl text-[#F8F4FF] max-[840px]:text-xl">Calendar</h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => shiftCalendarMonth(-1)}
                      className="rounded-full border border-white/20 px-3 py-1 text-xs text-[#B9B4D9]"
                    >
                      ←
                    </button>
                    <span className="rounded-full border border-[#C084FC66] bg-[#C084FC1A] px-3 py-1 font-sans text-xs text-[#C084FC]">
                      {new Date(`${calendarMonth}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                      type="button"
                      onClick={() => shiftCalendarMonth(1)}
                      className="rounded-full border border-white/20 px-3 py-1 text-xs text-[#B9B4D9]"
                    >
                      →
                    </button>
                  </div>
                </div>

                <div className="mb-3 flex items-center gap-2">
                  <select
                    value={calendarPlatformFilter}
                    onChange={(event) => setCalendarPlatformFilter(event.target.value as 'all' | Platform)}
                    className="h-10 rounded-xl border border-white/10 bg-black/25 px-3 font-sans text-sm text-[#F8F4FF] max-[840px]:h-8 max-[840px]:text-xs"
                  >
                    <option value="all">All platforms</option>
                    {PLATFORMS.map((platform) => (
                      <option key={platform} value={platform}>
                        {platform}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid h-[calc(100%-5.8rem)] grid-cols-[1fr_300px] gap-3 overflow-hidden max-[840px]:grid-cols-1">
                  <section className="min-h-0 rounded-2xl border border-white/10 bg-black/20 p-2.5">
                    <div className="mb-2 grid grid-cols-7 gap-1">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dow) => (
                        <div key={dow} className="px-1 py-1 text-center text-[11px] uppercase tracking-[0.1em] text-[#B9B4D9]">
                          {dow}
                        </div>
                      ))}
                    </div>
                    {calendarLoading ? (
                      <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: 42 }).map((_, idx) => (
                          <div key={idx} className="h-20 animate-pulse rounded-lg border border-white/10 bg-white/5" />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-7 gap-1">
                        {monthGridDays.map((day) => {
                          const dayKey = toDayKey(day);
                          const [yr, mo] = calendarMonth.split('-').map(Number);
                          const inMonth = day.getFullYear() === yr && day.getMonth() + 1 === mo;
                          const count = calendarItemsByDay.get(dayKey)?.length ?? 0;
                          const isSelected = calendarSelectedDay === dayKey;
                          return (
                            <button
                              key={dayKey}
                              type="button"
                              onClick={() => setCalendarSelectedDay(dayKey)}
                              className={`h-20 rounded-lg border p-1 text-left transition ${
                                isSelected
                                  ? 'border-[#FF3EA566] bg-[#FF3EA51f]'
                                  : 'border-white/10 bg-black/20 hover:border-white/20'
                              }`}
                            >
                              <p className={`text-xs ${inMonth ? 'text-[#F8F4FF]' : 'text-[#6f6994]'}`}>{day.getDate()}</p>
                              <div className="mt-1 flex items-center gap-1">
                                {count > 0 &&
                                  Array.from({ length: Math.min(3, count) }).map((_, idx) => (
                                    <span key={`${dayKey}-${idx}`} className="h-1.5 w-1.5 rounded-full bg-[#FF3EA5]" />
                                  ))}
                              </div>
                              {count > 0 && <p className="mt-1 text-[10px] text-[#B9B4D9]">{count}</p>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <section className="min-h-0 rounded-2xl border border-white/10 bg-black/20 p-3 max-[840px]:hidden">
                    <h3 className="font-sans text-sm text-[#F8F4FF]">
                      {calendarSelectedDay ? prettyDayHeader(calendarSelectedDay) : 'Select a day'}
                    </h3>
                    <div className="mt-2 h-[calc(100%-1.5rem)] space-y-2 overflow-y-auto pr-1">
                      {!calendarSelectedDay && (
                        <p className="text-xs text-[#B9B4D9]">Click a day to view scheduled posts.</p>
                      )}
                      {calendarSelectedDay && selectedDayItems.length === 0 && (
                        <p className="text-xs text-[#B9B4D9]">No scheduled posts on this day.</p>
                      )}
                      {selectedDayItems.map((item) => (
                        <article key={item.id} className="rounded-xl border border-white/10 bg-black/25 p-2.5">
                          <p className="line-clamp-1 text-xs text-[#F8F4FF]">{item.title}</p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className={platformBadge(item.platform)}>{item.platform}</span>
                            <span className={statusBadge(item.status)}>{item.status}</span>
                          </div>
                          <p className="mt-1 text-[11px] text-[#B9B4D9]">{displayDateTime(item.scheduled_at)}</p>
                          <button
                            type="button"
                            onClick={() => openCalendarReschedule(item)}
                            className="mt-2 rounded-md border border-[#C084FC66] bg-[#C084FC1F] px-2 py-1 text-[10px] text-[#E3CCFF]"
                          >
                            Reschedule
                          </button>
                        </article>
                      ))}
                    </div>
                  </section>
                </div>
              </>
            )}

            {activeSection === 'analytics' && (
              <>
                <div className="mb-3 flex items-center justify-between gap-2 max-[840px]:mb-2">
                  <h2 className="font-serif text-3xl text-[#F8F4FF] max-[840px]:text-xl">Analytics</h2>
                  <span className="rounded-full border border-[#C084FC66] bg-[#C084FC1A] px-3 py-1 text-xs text-[#C084FC]">
                    Posted metrics
                  </span>
                </div>
                <div className="mb-3 grid grid-cols-5 gap-2 max-[840px]:grid-cols-2">
                  {statusPill('Posts', analyticsSummary?.total_posts_posted ?? 0)}
                  {statusPill('Views', analyticsSummary?.total_views ?? 0)}
                  {statusPill('Revenue', Number(analyticsSummary?.total_revenue ?? 0))}
                  {statusPill('Best Platform', analyticsSummary?.best_platform?.views ?? 0)}
                  {statusPill(
                    'Best Category',
                    Number(((analyticsSummary?.best_category?.avg_engagement ?? 0) * 100).toFixed(1)) as number,
                  )}
                </div>
                <section className="h-[calc(100%-8.5rem)] overflow-auto rounded-2xl border border-white/10 bg-black/20">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[rgba(18,16,40,0.95)] text-[#B9B4D9]">
                      <tr>
                        <th className="px-2 py-2">Title</th>
                        <th className="px-2 py-2">Platform</th>
                        <th className="px-2 py-2">Category</th>
                        <th className="px-2 py-2">Views</th>
                        <th className="px-2 py-2">Eng %</th>
                        <th className="px-2 py-2">Revenue</th>
                        <th className="px-2 py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsLoading ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-3 text-[#B9B4D9]">
                            Loading analytics...
                          </td>
                        </tr>
                      ) : analyticsItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-3 text-[#B9B4D9]">
                            No posted items yet.
                          </td>
                        </tr>
                      ) : (
                        analyticsItems.map((item) => (
                          <tr key={item.content_item_id} className="border-t border-white/5">
                            <td className="px-2 py-2 text-[#F8F4FF]">{item.title}</td>
                            <td className="px-2 py-2">
                              <span className={platformBadge(item.platform)}>{item.platform}</span>
                            </td>
                            <td className="px-2 py-2 text-[#B9B4D9]">{item.category || '—'}</td>
                            <td className="px-2 py-2 text-[#F8F4FF]">{item.views}</td>
                            <td className="px-2 py-2 text-[#F8F4FF]">{(item.engagement_rate * 100).toFixed(2)}%</td>
                            <td className="px-2 py-2 text-[#F8F4FF]">£{item.revenue.toFixed(2)}</td>
                            <td className="px-2 py-2">
                              <button
                                type="button"
                                onClick={() => openMetricsModal(item)}
                                className="rounded-md border border-white/15 px-2 py-1 text-[11px] text-[#F8F4FF]"
                              >
                                Edit metrics
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </section>
              </>
            )}

            {activeSection === 'affiliate' && (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-serif text-3xl text-[#F8F4FF] max-[840px]:text-xl">Affiliate Marketing</h2>
                  <span className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-3 py-1 text-xs text-[#F8F4FF]">
                    Personal only
                  </span>
                </div>
                <div className="mb-3 grid grid-cols-3 gap-2 max-[840px]:grid-cols-2">
                  {statusPill('Total £', Number(affiliateSummary?.total_amount ?? 0))}
                  {statusPill('Logs', affiliateSummary?.logs_count ?? 0)}
                  {statusPill('Links', affiliateLinks.length)}
                </div>
                <div className="grid h-[calc(100%-8.2rem)] grid-cols-2 gap-3 overflow-hidden max-[840px]:grid-cols-1">
                  <section className="min-h-0 overflow-auto rounded-2xl border border-white/10 bg-black/20 p-3">
                    <h3 className="font-sans text-sm text-[#F8F4FF]">Link Bank</h3>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <input
                        placeholder="Network"
                        value={affiliateForm.network}
                        onChange={(e) => setAffiliateForm((s) => ({ ...s, network: e.target.value }))}
                        className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-[#F8F4FF]"
                      />
                      <input
                        placeholder="Product"
                        value={affiliateForm.product_name}
                        onChange={(e) => setAffiliateForm((s) => ({ ...s, product_name: e.target.value }))}
                        className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-[#F8F4FF]"
                      />
                      <input
                        placeholder="URL"
                        value={affiliateForm.url}
                        onChange={(e) => setAffiliateForm((s) => ({ ...s, url: e.target.value }))}
                        className="col-span-2 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-[#F8F4FF]"
                      />
                      <input
                        placeholder="Commission %"
                        value={affiliateForm.commission_percent}
                        onChange={(e) => setAffiliateForm((s) => ({ ...s, commission_percent: e.target.value }))}
                        className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-[#F8F4FF]"
                      />
                      <button
                        type="button"
                        onClick={() => void createAffiliateLink()}
                        className="rounded-lg border border-[#FF3EA566] bg-[#FF3EA522] px-2 py-1 text-xs text-[#F8F4FF]"
                      >
                        {editingAffiliateLinkId ? 'Update Link' : 'Add Link'}
                      </button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {affiliateLoading && <p className="text-xs text-[#B9B4D9]">Loading...</p>}
                      {affiliateLinks.map((link) => (
                        <div key={link.id} className="rounded-lg border border-white/10 p-2">
                          <p className="text-xs text-[#F8F4FF]">{link.product_name}</p>
                          <p className="text-[11px] text-[#B9B4D9]">{link.network}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAffiliateLinkId(link.id);
                                setAffiliateForm({
                                  network: link.network,
                                  product_name: link.product_name,
                                  url: link.url,
                                  commission_percent: link.commission_percent === null ? '' : String(link.commission_percent),
                                });
                              }}
                              className="text-[10px] text-[#C084FC]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteAffiliateLink(link.id)}
                              className="text-[10px] text-[#ff9acb]"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="min-h-0 overflow-auto rounded-2xl border border-white/10 bg-black/20 p-3">
                    <h3 className="font-sans text-sm text-[#F8F4FF]">Earnings + Attach</h3>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <select
                        value={earningForm.affiliate_id}
                        onChange={(e) => setEarningForm((s) => ({ ...s, affiliate_id: e.target.value }))}
                        className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-[#F8F4FF]"
                      >
                        <option value="">Affiliate link</option>
                        {affiliateLinks.map((link) => (
                          <option key={link.id} value={String(link.id)}>
                            {link.product_name}
                          </option>
                        ))}
                      </select>
                      <input
                        placeholder="Amount"
                        value={earningForm.amount}
                        onChange={(e) => setEarningForm((s) => ({ ...s, amount: e.target.value }))}
                        className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-[#F8F4FF]"
                      />
                      <input
                        type="date"
                        value={earningForm.earned_date}
                        onChange={(e) => setEarningForm((s) => ({ ...s, earned_date: e.target.value }))}
                        className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-[#F8F4FF]"
                      />
                      <button
                        type="button"
                        onClick={() => void createAffiliateEarning()}
                        className="rounded-lg border border-[#FF3EA566] bg-[#FF3EA522] px-2 py-1 text-xs text-[#F8F4FF]"
                      >
                        {editingEarningId ? 'Update Earning' : 'Add Earning'}
                      </button>
                    </div>

                    <div className="mt-3 space-y-2">
                      {affiliateEarnings.map((earning) => (
                        <div key={earning.id} className="flex items-center justify-between rounded-lg border border-white/10 p-2">
                          <p className="text-xs text-[#F8F4FF]">£{earning.amount.toFixed(2)} • {earning.earned_date}</p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingEarningId(earning.id);
                                setEarningForm({
                                  affiliate_id: String(earning.affiliate_id),
                                  content_item_id: earning.content_item_id ? String(earning.content_item_id) : '',
                                  amount: String(earning.amount),
                                  earned_date: earning.earned_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
                                });
                              }}
                              className="text-[10px] text-[#C084FC]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteAffiliateEarning(earning.id)}
                              className="text-[10px] text-[#ff9acb]"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-xl border border-white/10 p-2">
                      <p className="text-xs text-[#B9B4D9]">Attach link to script/content</p>
                      <div className="mt-2 grid grid-cols-1 gap-2">
                        <select
                          value={attachAffiliateId}
                          onChange={(e) => setAttachAffiliateId(e.target.value)}
                          className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-[#F8F4FF]"
                        >
                          <option value="">Select link</option>
                          {affiliateLinks.map((link) => (
                            <option key={link.id} value={String(link.id)}>
                              {link.product_name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={attachScriptId}
                          onChange={(e) => setAttachScriptId(e.target.value)}
                          className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-[#F8F4FF]"
                        >
                          <option value="">Attach to script (optional)</option>
                          {scripts.map((script) => (
                            <option key={script.id} value={String(script.id)}>
                              {script.title}
                            </option>
                          ))}
                        </select>
                        <select
                          value={attachContentId}
                          onChange={(e) => setAttachContentId(e.target.value)}
                          className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-[#F8F4FF]"
                        >
                          <option value="">Attach to content item (optional)</option>
                          {items.map((item) => (
                            <option key={item.id} value={String(item.id)}>
                              {item.title}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => void attachAffiliate()}
                          className="rounded-lg border border-[#C084FC66] bg-[#C084FC1F] px-2 py-1 text-xs text-[#F8F4FF]"
                        >
                          Save Attachments
                        </button>
                      </div>
                    </div>
                  </section>
                </div>
              </>
            )}

            {activeSection === 'pr' && (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-serif text-3xl text-[#F8F4FF] max-[840px]:text-xl">PR Management</h2>
                  <span className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-3 py-1 text-xs text-[#F8F4FF]">
                    Personal only
                  </span>
                </div>
                <div className="mb-3 grid grid-cols-3 gap-2 max-[840px]:grid-cols-2">
                  {statusPill('Pending', prSummary?.pending_count ?? 0)}
                  {statusPill('Paid', prSummary?.paid_count ?? 0)}
                  {statusPill('PR Revenue £', Number(prSummary?.total_pr_revenue ?? 0))}
                </div>
                <div className="grid h-[calc(100%-8.2rem)] grid-cols-2 gap-3 overflow-hidden max-[840px]:grid-cols-1">
                  <section className="min-h-0 overflow-auto rounded-2xl border border-white/10 bg-black/20 p-3">
                    <h3 className="font-sans text-sm text-[#F8F4FF]">Brands</h3>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <input
                        placeholder="Company"
                        value={prBrandForm.company_name}
                        onChange={(e) => setPrBrandForm((s) => ({ ...s, company_name: e.target.value }))}
                        className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-[#F8F4FF]"
                      />
                      <select
                        value={prBrandForm.status}
                        onChange={(e) => setPrBrandForm((s) => ({ ...s, status: e.target.value }))}
                        className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-[#F8F4FF]"
                      >
                        <option value="pitched">pitched</option>
                        <option value="in_discussion">in_discussion</option>
                        <option value="gifted">gifted</option>
                        <option value="paid">paid</option>
                        <option value="declined">declined</option>
                      </select>
                      <input
                        placeholder="Email"
                        value={prBrandForm.contact_email}
                        onChange={(e) => setPrBrandForm((s) => ({ ...s, contact_email: e.target.value }))}
                        className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-[#F8F4FF]"
                      />
                      <input
                        placeholder="Contact person"
                        value={prBrandForm.contact_person}
                        onChange={(e) => setPrBrandForm((s) => ({ ...s, contact_person: e.target.value }))}
                        className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-[#F8F4FF]"
                      />
                      <textarea
                        placeholder="Notes"
                        value={prBrandForm.notes}
                        onChange={(e) => setPrBrandForm((s) => ({ ...s, notes: e.target.value }))}
                        className="col-span-2 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-[#F8F4FF]"
                      />
                      <button
                        type="button"
                        onClick={() => void createPrBrand()}
                        className="col-span-2 rounded-lg border border-[#FF3EA566] bg-[#FF3EA522] px-2 py-1 text-xs text-[#F8F4FF]"
                      >
                        {editingPrBrandId ? 'Update PR Brand' : 'Add PR Brand'}
                      </button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {prLoading && <p className="text-xs text-[#B9B4D9]">Loading...</p>}
                      {prBrands.map((brand) => (
                        <div key={brand.id} className="rounded-lg border border-white/10 p-2">
                          <p className="text-xs text-[#F8F4FF]">{brand.company_name}</p>
                          <p className="text-[11px] text-[#B9B4D9]">{brand.status}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPrBrandId(brand.id);
                                setPrBrandForm({
                                  company_name: brand.company_name,
                                  contact_email: brand.contact_email ?? '',
                                  contact_person: brand.contact_person ?? '',
                                  status: brand.status,
                                  notes: brand.notes ?? '',
                                });
                              }}
                              className="text-[10px] text-[#C084FC]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void deletePrBrand(brand.id)}
                              className="text-[10px] text-[#ff9acb]"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="min-h-0 overflow-auto rounded-2xl border border-white/10 bg-black/20 p-3">
                    <h3 className="font-sans text-sm text-[#F8F4FF]">Deliverables</h3>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <select
                        value={prDeliverableForm.pr_brand_id}
                        onChange={(e) => setPrDeliverableForm((s) => ({ ...s, pr_brand_id: e.target.value }))}
                        className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-[#F8F4FF]"
                      >
                        <option value="">PR Brand</option>
                        {prBrands.map((brand) => (
                          <option key={brand.id} value={String(brand.id)}>
                            {brand.company_name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={prDeliverableForm.content_item_id}
                        onChange={(e) => setPrDeliverableForm((s) => ({ ...s, content_item_id: e.target.value }))}
                        className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-[#F8F4FF]"
                      >
                        <option value="">Content item (optional)</option>
                        {items.map((item) => (
                          <option key={item.id} value={String(item.id)}>
                            {item.title}
                          </option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={prDeliverableForm.deadline}
                        onChange={(e) => setPrDeliverableForm((s) => ({ ...s, deadline: e.target.value }))}
                        className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-[#F8F4FF]"
                      />
                      <input
                        placeholder="Payment"
                        value={prDeliverableForm.payment_amount}
                        onChange={(e) => setPrDeliverableForm((s) => ({ ...s, payment_amount: e.target.value }))}
                        className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-[#F8F4FF]"
                      />
                      <select
                        value={prDeliverableForm.status}
                        onChange={(e) => setPrDeliverableForm((s) => ({ ...s, status: e.target.value }))}
                        className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-[#F8F4FF]"
                      >
                        <option value="pending">pending</option>
                        <option value="posted">posted</option>
                        <option value="paid">paid</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => void createPrDeliverable()}
                        className="rounded-lg border border-[#FF3EA566] bg-[#FF3EA522] px-2 py-1 text-xs text-[#F8F4FF]"
                      >
                        {editingPrDeliverableId ? 'Update Deliverable' : 'Add Deliverable'}
                      </button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {prDeliverables.map((d) => (
                        <div key={d.id} className="flex items-center justify-between rounded-lg border border-white/10 p-2">
                          <p className="text-xs text-[#F8F4FF]">
                            {d.status} • {d.deadline || 'No date'} {d.payment_amount ? `• £${Number(d.payment_amount).toFixed(2)}` : ''}
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPrDeliverableId(d.id);
                                setPrDeliverableForm({
                                  pr_brand_id: String(d.pr_brand_id),
                                  content_item_id: d.content_item_id ? String(d.content_item_id) : '',
                                  deadline: d.deadline?.slice(0, 10) ?? '',
                                  payment_amount: d.payment_amount === null ? '' : String(d.payment_amount),
                                  status: d.status,
                                });
                              }}
                              className="text-[10px] text-[#C084FC]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void deletePrDeliverable(d.id)}
                              className="text-[10px] text-[#ff9acb]"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </>
            )}

            {!['pipeline', 'scripts', 'drafts', 'calendar', 'analytics', 'affiliate', 'pr'].includes(activeSection) && (
              <section className="grid h-full place-items-center rounded-2xl border border-white/10 bg-black/20">
                <div className="text-center">
                  <h2 className="font-serif text-3xl text-[#F8F4FF] capitalize">{activeSection}</h2>
                  <p className="mt-1 font-sans text-sm text-[#B9B4D9]">This section shell is ready for the next feature slice.</p>
                </div>
              </section>
            )}
          </main>

          <aside className="min-h-0 overflow-y-auto rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.60)] p-4 pr-3 backdrop-blur-xl max-[840px]:p-2.5 max-[840px]:pr-2">
            <h3 className="font-serif text-2xl text-[#F8F4FF] max-[840px]:text-lg">Alerts</h3>
            <div className="mt-3 space-y-3 pr-1">
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="font-sans text-xs uppercase tracking-[0.12em] text-[#B9B4D9]">Drafts</p>
                <p className="mt-2 font-sans text-sm text-[#F8F4FF]">{summary?.draftsCount ?? 0} pending idea drafts</p>
              </div>
              {activeSection === 'scripts' && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="font-sans text-xs uppercase tracking-[0.12em] text-[#B9B4D9]">Scripts</p>
                  <p className="mt-2 font-sans text-sm text-[#F8F4FF]">{scripts.length} scripts in this brand</p>
                </div>
              )}
              {(summary?.alerts ?? []).slice(0, 3).map((alert) => (
                <div key={alert} className="rounded-xl border border-[#FF3EA566] bg-[#FF3EA522] p-3">
                  <p className="font-sans text-sm text-[#F8F4FF]">{alert}</p>
                </div>
              ))}
              {(summary?.alerts?.length ?? 0) === 0 && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="font-sans text-sm text-[#B9B4D9]">No alerts right now.</p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {itemModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.92)] p-4 backdrop-blur-xl">
            <h3 className="font-serif text-2xl text-[#F8F4FF]">{editingItemId ? 'Edit Content Item' : 'New Content Item'}</h3>
            <div className="mt-3 space-y-3">
              <label className="block space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Title *</span>
                <input
                  value={formTitle}
                  onChange={(event) => setFormTitle(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                />
              </label>
              <label className="block space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Platform *</span>
                <select
                  value={formPlatform}
                  onChange={(event) => setFormPlatform(event.target.value as Platform)}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                >
                  {PLATFORMS.map((platform) => (
                    <option key={platform} value={platform}>
                      {platform}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Category</span>
                <input
                  value={formCategory}
                  onChange={(event) => setFormCategory(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                />
              </label>
              {editingItemId && (
                <label className="block space-y-1 font-sans text-xs text-[#B9B4D9]">
                  <span>Status</span>
                  <select
                    value={formStatus}
                    onChange={(event) => setFormStatus(event.target.value as PipelineStatus)}
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                  >
                    {PIPELINE_COLUMNS.map((column) => (
                      <option key={column.key} value={column.key}>
                        {column.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                <input
                  type="checkbox"
                  checked={formMonetized}
                  onChange={(event) => setFormMonetized(event.target.checked)}
                />
                <span className="font-sans text-xs text-[#F8F4FF]">Monetized</span>
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setItemModalOpen(false)}
                className="rounded-full border border-white/20 px-4 py-1.5 font-sans text-xs text-[#B9B4D9]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveItem()}
                className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-4 py-1.5 font-sans text-xs text-[#F8F4FF]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {scriptModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="h-[min(88vh,860px)] w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.95)] p-4 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-serif text-2xl text-[#F8F4FF]">{editingScriptId ? 'Edit Script' : 'New Script'}</h3>
              <button
                type="button"
                onClick={() => setScriptModalOpen(false)}
                className="rounded-full border border-white/15 px-3 py-1 text-xs text-[#B9B4D9]"
              >
                Close
              </button>
            </div>

            <div className="grid h-[calc(100%-3rem)] grid-cols-2 gap-3 overflow-hidden">
              <div className="space-y-3 overflow-y-auto pr-1">
                <label className="block space-y-1 font-sans text-xs text-[#B9B4D9]">
                  <span>Title *</span>
                  <input
                    value={scriptTitle}
                    onChange={(event) => setScriptTitle(event.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1 font-sans text-xs text-[#B9B4D9]">
                    <span>Platform *</span>
                    <select
                      value={scriptPlatform}
                      onChange={(event) => setScriptPlatform(event.target.value as Platform)}
                      className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                    >
                      {PLATFORMS.map((platform) => (
                        <option key={platform} value={platform}>
                          {platform}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1 font-sans text-xs text-[#B9B4D9]">
                    <span>Category</span>
                    <input
                      value={scriptCategory}
                      onChange={(event) => setScriptCategory(event.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                    />
                  </label>
                </div>

                <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={scriptMonetized}
                    onChange={(event) => setScriptMonetized(event.target.checked)}
                  />
                  <span className="font-sans text-xs text-[#F8F4FF]">Monetized</span>
                </label>

                <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-sans text-xs uppercase tracking-[0.1em] text-[#B9B4D9]">Hook Lines (3-6)</p>
                    <button
                      type="button"
                      onClick={() => {
                        if (scriptHookLines.length >= 6) return;
                        setScriptHookLines((prev) => [...prev, '']);
                      }}
                      className="rounded-md border border-[#C084FC66] px-2 py-0.5 text-[11px] text-[#E3CCFF]"
                    >
                      + Line
                    </button>
                  </div>
                  {scriptHookLines.map((line, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        value={line}
                        onChange={(event) => {
                          const next = [...scriptHookLines];
                          next[index] = event.target.value;
                          setScriptHookLines(next);
                        }}
                        className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (scriptHookLines.length <= 3) return;
                          setScriptHookLines((prev) => prev.filter((_, i) => i !== index));
                        }}
                        className="rounded-md border border-white/15 px-2 py-1 text-xs text-[#B9B4D9]"
                      >
                        −
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 overflow-y-auto pr-1">
                <label className="block space-y-1 font-sans text-xs text-[#B9B4D9]">
                  <span>Body *</span>
                  <textarea
                    value={scriptBody}
                    onChange={(event) => setScriptBody(event.target.value)}
                    rows={10}
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                  />
                </label>

                <label className="block space-y-1 font-sans text-xs text-[#B9B4D9]">
                  <span>CTA</span>
                  <textarea
                    value={scriptCta}
                    onChange={(event) => setScriptCta(event.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                  />
                </label>

                <label className="block space-y-1 font-sans text-xs text-[#B9B4D9]">
                  <span>Hashtags</span>
                  <input
                    value={scriptHashtags}
                    onChange={(event) => setScriptHashtags(event.target.value)}
                    placeholder="#productivity, #routine"
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                  />
                </label>

                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => void saveScript()}
                    className="rounded-full border border-white/20 px-4 py-1.5 font-sans text-xs text-[#B9B4D9]"
                  >
                    Save Script
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveAndConvertScript()}
                    className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-4 py-1.5 font-sans text-xs text-[#F8F4FF]"
                  >
                    Convert to Pipeline Item
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {logFilmedModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.95)] p-4 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-serif text-2xl text-[#F8F4FF]">Log Filmed Content</h3>
              <button
                type="button"
                onClick={() => setLogFilmedModalOpen(false)}
                className="rounded-full border border-white/15 px-3 py-1 text-xs text-[#B9B4D9]"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Title *</span>
                <input
                  value={logFilmedTitle}
                  onChange={(event) => setLogFilmedTitle(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                />
              </label>

              <label className="block space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Platform *</span>
                <select
                  value={logFilmedPlatform}
                  onChange={(event) => setLogFilmedPlatform(event.target.value as Platform)}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                >
                  {PLATFORMS.map((platform) => (
                    <option key={platform} value={platform}>
                      {platform}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Category</span>
                <input
                  value={logFilmedCategory}
                  onChange={(event) => setLogFilmedCategory(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                />
              </label>

              <label className="block space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Attach Script (optional)</span>
                <select
                  value={logFilmedScriptId}
                  onChange={(event) => setLogFilmedScriptId(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                >
                  <option value="">No script</option>
                  {scripts.map((script) => (
                    <option key={script.id} value={String(script.id)}>
                      {script.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="col-span-2 block space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Short Description</span>
                <textarea
                  value={logFilmedDescription}
                  onChange={(event) => setLogFilmedDescription(event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                />
              </label>

              <label className="col-span-2 flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                <input
                  type="checkbox"
                  checked={logFilmedMonetized}
                  onChange={(event) => setLogFilmedMonetized(event.target.checked)}
                />
                <span className="font-sans text-xs text-[#F8F4FF]">Monetized</span>
              </label>

              <label className="col-span-2 block space-y-1 font-sans text-xs text-[#B9B4D9]">
                <span>Thumbnail Upload (optional)</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void uploadDraftThumbnail(file);
                  }}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                />
                {logFilmedUploading && <p className="text-[11px] text-[#B9B4D9]">Uploading...</p>}
                {logFilmedThumbnailPath && (
                  <p className="truncate text-[11px] text-[#C084FC]">Saved: {logFilmedThumbnailPath}</p>
                )}
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLogFilmedModalOpen(false)}
                className="rounded-full border border-white/20 px-4 py-1.5 font-sans text-xs text-[#B9B4D9]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveFilmedDraft()}
                className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-4 py-1.5 font-sans text-xs text-[#F8F4FF]"
              >
                Save Filmed
              </button>
            </div>
          </div>
        </div>
      )}

      {scheduleModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.95)] p-4">
            <h3 className="font-serif text-2xl text-[#F8F4FF]">Schedule Draft</h3>
            <p className="mt-1 line-clamp-1 text-xs text-[#B9B4D9]">{scheduleModal.title}</p>
            <label className="mt-3 block space-y-1 font-sans text-xs text-[#B9B4D9]">
              <span>Schedule at *</span>
              <input
                type="datetime-local"
                value={scheduledAtInput}
                onChange={(event) => setScheduledAtInput(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setScheduleModal(null)}
                className="rounded-full border border-white/20 px-4 py-1.5 font-sans text-xs text-[#B9B4D9]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void scheduleDraft()}
                className="rounded-full border border-[#C084FC66] bg-[#C084FC1F] px-4 py-1.5 font-sans text-xs text-[#F8F4FF]"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {postModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.95)] p-4">
            <h3 className="font-serif text-2xl text-[#F8F4FF]">Mark Posted</h3>
            <p className="mt-1 line-clamp-1 text-xs text-[#B9B4D9]">{postModal.title}</p>
            <label className="mt-3 block space-y-1 font-sans text-xs text-[#B9B4D9]">
              <span>Posted at *</span>
              <input
                type="datetime-local"
                value={postedAtInput}
                onChange={(event) => setPostedAtInput(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPostModal(null)}
                className="rounded-full border border-white/20 px-4 py-1.5 font-sans text-xs text-[#B9B4D9]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void postDraft()}
                className="rounded-full border border-[#47d58c66] bg-[#47d58c1f] px-4 py-1.5 font-sans text-xs text-[#F8F4FF]"
              >
                Mark Posted
              </button>
            </div>
          </div>
        </div>
      )}

      {calendarReschedule && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.95)] p-4">
            <h3 className="font-serif text-2xl text-[#F8F4FF]">Reschedule Post</h3>
            <p className="mt-1 line-clamp-1 text-xs text-[#B9B4D9]">{calendarReschedule.title}</p>
            <label className="mt-3 block space-y-1 font-sans text-xs text-[#B9B4D9]">
              <span>New time *</span>
              <input
                type="datetime-local"
                value={calendarRescheduleInput}
                onChange={(event) => setCalendarRescheduleInput(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCalendarReschedule(null)}
                className="rounded-full border border-white/20 px-4 py-1.5 font-sans text-xs text-[#B9B4D9]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveCalendarReschedule()}
                className="rounded-full border border-[#C084FC66] bg-[#C084FC1F] px-4 py-1.5 font-sans text-xs text-[#F8F4FF]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {metricsModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.95)] p-4">
            <h3 className="font-serif text-2xl text-[#F8F4FF]">Edit Metrics</h3>
            <p className="mt-1 line-clamp-1 text-xs text-[#B9B4D9]">{metricsModal.title}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(['views', 'likes', 'comments', 'shares', 'saves', 'revenue'] as const).map((field) => (
                <label key={field} className="space-y-1 text-xs text-[#B9B4D9]">
                  <span className="capitalize">{field}</span>
                  <input
                    type="number"
                    min={0}
                    step={field === 'revenue' ? '0.01' : '1'}
                    value={metricsForm[field]}
                    onChange={(event) =>
                      setMetricsForm((prev) => ({
                        ...prev,
                        [field]: Number(event.target.value || 0),
                      }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMetricsModal(null)}
                className="rounded-full border border-white/20 px-4 py-1.5 font-sans text-xs text-[#B9B4D9]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveMetrics()}
                className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-4 py-1.5 font-sans text-xs text-[#F8F4FF]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </BackgroundShell>
  );
}
