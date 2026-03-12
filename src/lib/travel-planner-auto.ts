import { computeDurationDays, enumerateYmdRange, parseYmdToDate } from './travel-dates';

export type AutoOutfit = {
  outfitName: string;
  pieces: string[];
};

export type AutoItineraryDay = {
  id: string;
  title: string;
  notes: string;
};

export type AutoPackingItem = {
  id: string;
  text: string;
  checked: boolean;
};

export type AutoPackingCard = {
  id: string;
  title: string;
  icon?: string;
  items: AutoPackingItem[];
};

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function seasonFromDate(date: Date) {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return 'Spring';
  if (month >= 6 && month <= 8) return 'Summer';
  if (month >= 9 && month <= 11) return 'Autumn';
  return 'Winter';
}

function tripMode(durationDays: number) {
  if (durationDays <= 1) return 'same_day';
  if (durationDays <= 4) return 'weekend';
  return 'holiday';
}

function qty(basePerDay: number, durationDays: number, min = 1) {
  return Math.max(min, Math.ceil(basePerDay * Math.max(1, durationDays)));
}

function makeItem(text: string) {
  return {
    id: `item-${slug(text)}-${Math.random().toString(16).slice(2, 6)}`,
    text,
    checked: false,
  };
}

function addCard(title: string, icon: string, items: string[]): AutoPackingCard {
  return {
    id: `card-${slug(title)}`,
    title,
    icon,
    items: items.map((entry) => makeItem(entry)),
  };
}

export function buildAutoItinerary(startYmd: string, endYmd: string, city: string): AutoItineraryDay[] {
  const dates = enumerateYmdRange(startYmd, endYmd);
  if (dates.length === 0) return [];

  const mode = tripMode(computeDurationDays(startYmd, endYmd));
  return dates.map((ymd, index) => {
    const dayNumber = index + 1;
    if (mode === 'same_day') {
      return {
        id: `day-${dayNumber}`,
        title: `Day ${dayNumber}: ${city} reset day`,
        notes: 'Morning coffee walk, one key activity, then a calm evening wind-down.',
      };
    }
    if (mode === 'weekend') {
      return {
        id: `day-${dayNumber}`,
        title: `Day ${dayNumber}: ${city} highlights`,
        notes:
          dayNumber === 1
            ? 'Arrival, check-in, light local exploration.'
            : dayNumber === dates.length
              ? 'Slow morning, final stop, check-out and travel back.'
              : 'Core experiences, food spots, and one flexible buffer block.',
      };
    }
    return {
      id: `day-${dayNumber}`,
      title: `Day ${dayNumber}: ${city} plan`,
      notes:
        dayNumber === 1
          ? 'Arrival, settle in, and short neighborhood orientation.'
          : dayNumber === dates.length
            ? 'Wrap-up day: souvenirs, final photos, departure prep.'
            : 'Morning activity, afternoon anchor plan, evening recovery time.',
    };
  });
}

export function buildAutoPackingCards(input: {
  startYmd: string;
  endYmd: string;
  outfits: AutoOutfit[];
  city: string;
}): AutoPackingCard[] {
  const durationDays = computeDurationDays(input.startYmd, input.endYmd);
  const mode = tripMode(durationDays);
  const startDate = parseYmdToDate(input.startYmd) ?? new Date();
  const season = seasonFromDate(startDate);

  const essentials = [
    `Passport / ID x1`,
    `Wallet + payment cards x1`,
    `Travel tickets / confirmations x1`,
    `Phone x1`,
    `Keys x1`,
  ];

  const clothes = [
    `Outfits x${Math.max(1, Math.min(durationDays, 10))}`,
    `Tops x${qty(1, durationDays)}`,
    `Bottoms x${qty(0.6, durationDays)}`,
    `Underwear x${qty(1.1, durationDays)}`,
    `Socks x${qty(1, durationDays)}`,
    `Sleepwear x${Math.max(1, Math.ceil(durationDays / 2))}`,
    `Season layer (${season}) x1`,
    mode === 'holiday' ? `Laundry bag x1` : `Compact bag x1`,
  ];

  const toiletries = [
    `Toothbrush + toothpaste x1`,
    `Skincare essentials x1 set`,
    `Deodorant x1`,
    `Hair brush/comb x1`,
    `Mini perfume / body mist x1`,
  ];

  const tech = [
    `Phone charger x1`,
    `Power bank x1`,
    `Travel adapter x1`,
    `Earphones x1`,
  ];

  const lifestyle = [
    `Reusable water bottle x1`,
    `Snacks for transit x${Math.max(1, Math.ceil(durationDays / 2))}`,
    `Notebook or journal x1`,
  ];

  const outfitItems = input.outfits.flatMap((outfit) =>
    outfit.pieces.map((piece) => `From outfit "${outfit.outfitName}": ${piece}`),
  );
  if (outfitItems.length > 0) {
    clothes.push(...outfitItems.slice(0, 16));
  }

  return [
    addCard('Essentials', '🪪', essentials),
    addCard('Clothes', '👗', clothes),
    addCard('Toiletries', '🧴', toiletries),
    addCard('Tech', '🔌', tech),
    addCard('Lifestyle', '☁️', lifestyle),
  ];
}
