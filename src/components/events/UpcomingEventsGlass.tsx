'use client';

import { useCallback, useEffect, useState } from 'react';
import { GlassCard } from '../GlassCard';
import { formatTimeLondon } from '../../lib/events-helpers';
import type { EventItem } from '../../lib/events-types';
import { EventsModal } from './EventsModal';

export function UpcomingEventsGlass() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<'upcoming' | 'add' | 'all'>('upcoming');

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/events/upcoming?limit=3&days=7', { cache: 'no-store' });
      if (!response.ok) {
        setEvents([]);
        return;
      }
      const payload = (await response.json().catch(() => [])) as EventItem[];
      setEvents(Array.isArray(payload) ? payload.slice(0, 3) : []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  return (
    <>
      <GlassCard
        className="flex-1 cursor-pointer border-[#FF3EA566] bg-[rgba(255,62,165,0.16)] p-4 max-[900px]:p-2.5"
        role="button"
        tabIndex={0}
        onClick={() => {
          setInitialTab('upcoming');
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setInitialTab('upcoming');
            setOpen(true);
          }
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-xl text-[#F8F4FF]">Events</h2>
            <img
              src="/Images/LandingPage/events.png"
              alt="Events"
              className="h-5 w-5 rounded-md object-cover shadow-[0_0_10px_rgba(255,255,255,0.22)]"
            />
          </div>
          {events.length === 0 && !loading && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setInitialTab('add');
                setOpen(true);
              }}
              className="interactive-cta rounded-full border border-[#FF3EA560] bg-[#FF3EA51A] px-3 py-1 font-sans text-xs text-[#F8F4FF] transition-all duration-300 hover:bg-[#FF3EA533]"
            >
              + Add
            </button>
          )}
        </div>

        <div className="space-y-2 max-[900px]:space-y-1.5">
          {loading ? (
            <div className="shimmer h-20 rounded-xl bg-white/10" />
          ) : events.length === 0 ? (
            <p className="font-sans text-sm text-[#B9B4D9]">No upcoming events</p>
          ) : (
            events.map((eventItem) => (
              <div key={eventItem.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 max-[900px]:px-2.5 max-[900px]:py-1.5">
                <p className="font-sans text-xs text-[#B9B4D9]">{formatTimeLondon(eventItem.start_at)}</p>
                <p className="font-sans text-sm text-[#F8F4FF]">{eventItem.title}</p>
                {eventItem.location && <p className="font-sans text-xs text-[#B9B4D9]">{eventItem.location}</p>}
              </div>
            ))
          )}
        </div>
      </GlassCard>

      <EventsModal
        open={open}
        initialTab={initialTab}
        onClose={() => setOpen(false)}
        onChanged={loadPreview}
      />
    </>
  );
}
