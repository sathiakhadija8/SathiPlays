export type PlannerItineraryDay = {
  id: string;
  title: string;
  notes: string;
};

export type PlannerPackingItem = {
  id: string;
  text: string;
  checked: boolean;
};

export type PlannerPackingCard = {
  id: string;
  title: string;
  icon?: string;
  items: PlannerPackingItem[];
};

export type PlannerBudget = {
  flights: number;
  hotel: number;
  activities: number;
  food: number;
  misc: number;
};

export type PlannerTripData = {
  itinerary: PlannerItineraryDay[];
  packingCards: PlannerPackingCard[];
  budget: PlannerBudget;
};

const DEFAULT_PACKING_CARD_TITLES = ['Clothes', 'Toiletries', 'Tech', 'Documents', 'Misc / Other'] as const;

function toStringSafe(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

export function createDefaultPackingCards(): PlannerPackingCard[] {
  return DEFAULT_PACKING_CARD_TITLES.map((title) => ({
    id: `card-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    title,
    items: [],
  }));
}

export function normalizePackingCards(raw: unknown): PlannerPackingCard[] {
  const source =
    raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray((raw as { packingCards?: unknown }).packingCards)
      ? (raw as { packingCards: unknown[] }).packingCards
      : Array.isArray(raw)
        ? raw
        : [];

  const cards: PlannerPackingCard[] = [];

  if (source.length > 0 && source.every((entry) => typeof entry === 'object' && entry !== null && 'items' in (entry as object))) {
    for (const entry of source as Array<{ id?: unknown; title?: unknown; icon?: unknown; items?: unknown }>) {
      const title = toStringSafe(entry.title).trim();
      if (!title) continue;
      const itemsRaw = Array.isArray(entry.items) ? entry.items : [];
      cards.push({
        id: toStringSafe(entry.id).trim() || `card-${Math.random().toString(16).slice(2, 8)}`,
        title,
        icon: toStringSafe(entry.icon).trim() || undefined,
        items: itemsRaw
          .map((item) => ({
            id:
              typeof item === 'object' && item && 'id' in item && typeof (item as { id?: unknown }).id === 'string'
                ? String((item as { id: string }).id)
                : `item-${Math.random().toString(16).slice(2, 8)}`,
            text:
              typeof item === 'object' && item && 'text' in item
                ? toStringSafe((item as { text?: unknown }).text).trim()
                : '',
            checked:
              typeof item === 'object' && item && 'checked' in item
                ? Boolean((item as { checked?: unknown }).checked)
                : false,
          }))
          .filter((item) => item.text.length > 0),
      });
    }
  } else if (source.length > 0) {
    // Legacy format: [{ id, text, category, checked }]
    const grouped = new Map<string, PlannerPackingItem[]>();
    for (const legacy of source as Array<{ id?: unknown; text?: unknown; category?: unknown; checked?: unknown }>) {
      const text = toStringSafe(legacy.text).trim();
      if (!text) continue;
      const category = toStringSafe(legacy.category, 'Misc / Other').trim() || 'Misc / Other';
      const list = grouped.get(category) ?? [];
      list.push({
        id: toStringSafe(legacy.id).trim() || `item-${Math.random().toString(16).slice(2, 8)}`,
        text,
        checked: Boolean(legacy.checked),
      });
      grouped.set(category, list);
    }

    for (const [title, items] of grouped.entries()) {
      cards.push({
        id: `card-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(16).slice(2, 6)}`,
        title,
        items,
      });
    }
  }

  const existing = new Set(cards.map((card) => card.title.toLowerCase()));
  for (const title of DEFAULT_PACKING_CARD_TITLES) {
    if (!existing.has(title.toLowerCase())) {
      cards.push({
        id: `card-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        title,
        items: [],
      });
    }
  }

  return cards;
}
