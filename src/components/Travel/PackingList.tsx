'use client';

import { useMemo, useState } from 'react';
import type { PlannerPackingCard } from './plannerTypes';

export type PlannerSupplementPackingItem = {
  supplement_id: number;
  name: string;
  dosage: string | null;
  frequency_type: 'daily' | 'weekly' | 'monthly';
  time_of_day: 'morning' | 'evening' | 'night';
  times_per_day: number;
  schedule: string;
  pack_quantity: number;
};

export function PackingList({
  cards,
  onChange,
  supplements,
  supplementsLoading,
}: {
  cards: PlannerPackingCard[];
  onChange: (next: PlannerPackingCard[]) => void;
  supplements: PlannerSupplementPackingItem[];
  supplementsLoading: boolean;
}) {
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardIcon, setNewCardIcon] = useState('');
  const [draftItemTextByCard, setDraftItemTextByCard] = useState<Record<string, string>>({});

  const totalItems = useMemo(
    () => cards.reduce((sum, card) => sum + card.items.length, 0),
    [cards],
  );

  const addCard = () => {
    const title = newCardTitle.trim();
    if (!title) return;
    onChange([
      ...cards,
      {
        id: `card-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        title,
        icon: newCardIcon.trim() || undefined,
        items: [],
      },
    ]);
    setNewCardTitle('');
    setNewCardIcon('');
  };

  const removeCard = (cardId: string) => {
    onChange(cards.filter((card) => card.id !== cardId));
  };

  const updateCard = (cardId: string, updater: (card: PlannerPackingCard) => PlannerPackingCard) => {
    onChange(cards.map((card) => (card.id === cardId ? updater(card) : card)));
  };

  const addItem = (cardId: string) => {
    const text = (draftItemTextByCard[cardId] ?? '').trim();
    if (!text) return;
    updateCard(cardId, (card) => ({
      ...card,
      items: [
        ...card.items,
        {
          id: `item-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
          text,
          checked: false,
        },
      ],
    }));
    setDraftItemTextByCard((prev) => ({ ...prev, [cardId]: '' }));
  };

  return (
    <section className="rounded-2xl border border-[#d8e8fb44] bg-[rgba(12,23,40,0.46)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="font-serif text-xl text-[#F2F7FF]">Packing</h4>
        <span className="text-xs text-[#C9D9EE]">{totalItems} item{totalItems === 1 ? '' : 's'}</span>
      </div>

      <div className="mb-3 rounded-xl border border-[#d7e6ff33] bg-[rgba(201,222,255,0.08)] p-2">
        <p className="mb-2 text-xs font-semibold text-[#E8F2FF]">💊 Supplements Packing (Auto)</p>
        {supplementsLoading ? (
          <p className="text-xs text-[#AFC7E4]">Calculating supplements...</p>
        ) : supplements.length === 0 ? (
          <p className="text-xs text-[#AFC7E4]">No active supplements needed for this trip range.</p>
        ) : (
          <div className="space-y-1.5">
            {supplements.map((entry) => (
              <div
                key={entry.supplement_id}
                className="grid grid-cols-[1.4fr_1.1fr_0.6fr_0.9fr] gap-2 rounded-lg border border-[#d7e6ff2a] bg-[rgba(16,28,46,0.5)] px-2 py-1.5 text-[11px] text-[#DCEBFA]"
              >
                <span className="truncate">{entry.name}{entry.dosage ? ` (${entry.dosage})` : ''}</span>
                <span className="truncate text-[#BFD3EC]">{entry.schedule}</span>
                <span>{entry.times_per_day}x/day</span>
                <span className="font-semibold text-[#EEF6FF]">Pack: {entry.pack_quantity}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          addCard();
        }}
        className="mb-3 flex flex-wrap items-center gap-2"
      >
        <input
          value={newCardTitle}
          onChange={(event) => setNewCardTitle(event.target.value)}
          placeholder="Add custom card title"
          className="h-9 min-w-[180px] flex-1 rounded-xl border border-[#d7e6ff40] bg-[rgba(16,28,46,0.48)] px-3 text-xs text-[#F2F7FF]"
        />
        <input
          value={newCardIcon}
          onChange={(event) => setNewCardIcon(event.target.value)}
          placeholder="Icon (optional)"
          className="h-9 w-32 rounded-xl border border-[#d7e6ff40] bg-[rgba(16,28,46,0.48)] px-3 text-xs text-[#F2F7FF]"
        />
        <button
          type="submit"
          className="rounded-full border border-[#b7d2f2] bg-[rgba(190,218,248,0.16)] px-3 py-1 text-xs text-[#EEF5FF]"
        >
          + Add Card
        </button>
      </form>

      <div className="grid gap-2 lg:grid-cols-2">
        {cards.map((card) => (
          <div key={card.id} className="rounded-xl border border-[#d7e6ff33] bg-[rgba(201,222,255,0.08)] p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="truncate text-xs font-semibold text-[#E8F2FF]">
                {card.icon ? `${card.icon} ` : ''}
                {card.title}
              </p>
              <button
                type="button"
                onClick={() => removeCard(card.id)}
                className="rounded-full border border-[#d7e6ff33] px-2 py-0.5 text-[10px] text-[#D8E8FB]"
              >
                Delete card
              </button>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                addItem(card.id);
              }}
              className="mb-2 flex gap-1.5"
            >
              <input
                value={draftItemTextByCard[card.id] ?? ''}
                onChange={(event) =>
                  setDraftItemTextByCard((prev) => ({ ...prev, [card.id]: event.target.value }))
                }
                placeholder="Add item"
                className="h-8 flex-1 rounded-lg border border-[#d7e6ff40] bg-[rgba(16,28,46,0.48)] px-2 text-xs text-[#F2F7FF]"
              />
              <button
                type="submit"
                className="rounded-full border border-[#b7d2f2] bg-[rgba(190,218,248,0.16)] px-2 py-0.5 text-[10px] text-[#EEF5FF]"
              >
                Add
              </button>
            </form>

            <div className="space-y-1">
              {card.items.length === 0 ? <p className="text-[11px] text-[#AFC7E4]">No items yet.</p> : null}
              {card.items.map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded-lg border border-[#d7e6ff2a] bg-[rgba(16,28,46,0.48)] px-2 py-1">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(event) =>
                      updateCard(card.id, (current) => ({
                        ...current,
                        items: current.items.map((entry) =>
                          entry.id === item.id ? { ...entry, checked: event.target.checked } : entry,
                        ),
                      }))
                    }
                    className="h-3.5 w-3.5"
                  />
                  <input
                    value={item.text}
                    onChange={(event) =>
                      updateCard(card.id, (current) => ({
                        ...current,
                        items: current.items.map((entry) =>
                          entry.id === item.id ? { ...entry, text: event.target.value } : entry,
                        ),
                      }))
                    }
                    className={`h-7 flex-1 rounded-md border border-[#d7e6ff33] bg-[rgba(16,28,46,0.42)] px-2 text-[11px] text-[#F2F7FF] ${
                      item.checked ? 'line-through opacity-60' : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateCard(card.id, (current) => ({
                        ...current,
                        items: current.items.filter((entry) => entry.id !== item.id),
                      }))
                    }
                    className="rounded-full border border-[#d7e6ff33] px-1.5 py-0.5 text-[10px] text-[#D8E8FB]"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
