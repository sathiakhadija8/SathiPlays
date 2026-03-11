'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { EventsCalendarMonth } from './EventsCalendarMonth';
import { EventsList } from './EventsList';
import { AddEventForm } from './AddEventForm';
import { monthKeyFromDate } from '../../lib/events-helpers';
import type { EventItem, MonthCountItem } from '../../lib/events-types';
import { usePlatformWindowOpen } from '../../lib/use-platform-window-open';

type Tab = 'upcoming' | 'add' | 'all';
type RangeMode = '7d' | '30d' | 'all';

type EventsModalProps = {
  open: boolean;
  initialTab?: Tab;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
};

const TABS: Tab[] = ['upcoming', 'add', 'all'];

export function EventsModal({ open, initialTab = 'upcoming', onClose, onChanged }: EventsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [monthDate, setMonthDate] = useState(new Date());
  const [countsByDate, setCountsByDate] = useState<Record<string, number>>({});
  const [upcomingEvents, setUpcomingEvents] = useState<EventItem[]>([]);
  const [allEvents, setAllEvents] = useState<EventItem[]>([]);
  const [dayEvents, setDayEvents] = useState<EventItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [rangeMode, setRangeMode] = useState<RangeMode>('all');
  const [search, setSearch] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  usePlatformWindowOpen(open);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
  }, [open, initialTab]);

  const fetchMonthCounts = async (forDate: Date) => {
    try {
      const month = monthKeyFromDate(forDate);
      const response = await fetch(`/api/events/month-counts?month=${month}`, { cache: 'no-store' });
      if (!response.ok) {
        setCountsByDate({});
        return;
      }
      const payload = (await response.json()) as MonthCountItem[];
      const mapped: Record<string, number> = {};
      for (const item of payload) mapped[item.date] = item.count;
      setCountsByDate(mapped);
    } catch {
      setCountsByDate({});
    }
  };

  const fetchUpcoming = async () => {
    setLoadingList(true);
    try {
      const response = await fetch('/api/events/range?mode=30d', { cache: 'no-store' });
      if (!response.ok) {
        setUpcomingEvents([]);
        return;
      }
      const payload = (await response.json()) as EventItem[];
      setUpcomingEvents(Array.isArray(payload) ? payload : []);
    } catch {
      setUpcomingEvents([]);
    } finally {
      setLoadingList(false);
    }
  };

  const fetchAll = async (mode: RangeMode) => {
    setLoadingList(true);
    try {
      const response = await fetch(`/api/events/range?mode=${mode}`, { cache: 'no-store' });
      if (!response.ok) {
        setAllEvents([]);
        return;
      }
      const payload = (await response.json()) as EventItem[];
      setAllEvents(Array.isArray(payload) ? payload : []);
    } catch {
      setAllEvents([]);
    } finally {
      setLoadingList(false);
    }
  };

  const fetchDay = async (date: string) => {
    setLoadingList(true);
    try {
      const response = await fetch(`/api/events/day?date=${date}`, { cache: 'no-store' });
      if (!response.ok) {
        setDayEvents([]);
        return;
      }
      const payload = (await response.json()) as EventItem[];
      setDayEvents(Array.isArray(payload) ? payload : []);
    } catch {
      setDayEvents([]);
    } finally {
      setLoadingList(false);
    }
  };

  const refreshAll = async () => {
    await Promise.allSettled([fetchMonthCounts(monthDate), fetchUpcoming(), fetchAll(rangeMode)]);
    if (selectedDate) {
      await fetchDay(selectedDate);
    }
    await Promise.resolve(onChanged());
  };

  const onEventAdded = async (savedDate: string) => {
    setSelectedDate(savedDate);
    setTab('upcoming');
    await Promise.allSettled([fetchMonthCounts(monthDate), fetchUpcoming(), fetchAll(rangeMode), fetchDay(savedDate)]);
    await Promise.resolve(onChanged());
  };

  useEffect(() => {
    if (!open) return;
    fetchMonthCounts(monthDate);
    fetchUpcoming();
    fetchAll(rangeMode);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    fetchMonthCounts(monthDate);
  }, [monthDate, open]);

  useEffect(() => {
    if (!open || tab !== 'all') return;
    fetchAll(rangeMode);
  }, [rangeMode, open, tab]);

  useEffect(() => {
    if (!open || !selectedDate) return;
    fetchDay(selectedDate);
  }, [selectedDate, open]);

  const onSelectDate = (date: string) => {
    setSelectedDate(date);
  };

  const baseEvents = tab === 'all' ? allEvents : upcomingEvents;
  const dateFilteredEvents = selectedDate ? dayEvents : baseEvents;
  const visibleEvents =
    tab === 'all' && search.trim()
      ? dateFilteredEvents.filter((event) => event.title.toLowerCase().includes(search.trim().toLowerCase()))
      : dateFilteredEvents;

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 p-4 backdrop-blur-sm">
      <div className="glass-depth-main flex h-[min(90vh,820px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 shadow-[0_0_36px_rgba(255,62,165,0.2)]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 className="font-serif text-2xl text-[#F8F4FF]">Events Window</h3>
          <button type="button" onClick={onClose} className="rounded-full border border-white/15 px-3 py-1 text-sm text-[#F8F4FF] hover:bg-white/10">Close</button>
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <EventsCalendarMonth
            monthDate={monthDate}
            countsByDate={countsByDate}
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
            onPrevMonth={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            onNextMonth={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
          />
        </div>

        <div className="flex items-center gap-2 px-4 pb-3">
          {TABS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-full border px-3 py-1 font-sans text-xs uppercase tracking-wide transition-all duration-300 hover:-translate-y-[1px] ${
                tab === value ? 'border-[#FF3EA560] bg-[#FF3EA522] text-[#F8F4FF]' : 'border-white/10 bg-white/5 text-[#B9B4D9]'
              }`}
            >
              {value}
            </button>
          ))}

          {tab === 'all' && (
            <>
              <div className="ml-2 flex gap-1">
                {(['7d', '30d', 'all'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRangeMode(value)}
                    className={`rounded-full border px-2 py-1 font-sans text-[10px] uppercase transition-all duration-300 ${
                      rangeMode === value ? 'border-[#FF3EA560] bg-[#FF3EA522] text-[#F8F4FF]' : 'border-white/10 text-[#B9B4D9]'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title"
                className="ml-auto rounded-full border border-white/10 bg-black/25 px-3 py-1 font-sans text-xs text-[#F8F4FF] placeholder:text-[#B9B4D9]"
              />
            </>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {tab === 'add' ? (
            <AddEventForm onSaved={onEventAdded} />
          ) : (
            <EventsList
              events={visibleEvents}
              loading={loadingList}
              selectedDate={selectedDate}
              onClearFilter={() => setSelectedDate(null)}
              onChanged={refreshAll}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
