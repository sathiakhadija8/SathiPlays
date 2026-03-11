export type MemoryBookKey = 'friendship' | 'solo' | 'pinterest';

export interface MemoryEntry {
  id: string;
  title: string;
  date: string;
  mood: string;
  note: string;
  images: string[];
}

export interface PlaceEntry {
  id: string;
  name: string;
  location: string;
  date: string;
  rating: number;
  note: string;
  images: string[];
  tag: string;
}

export interface MagazineEntry {
  id: string;
  label: string;
  title: string;
  date: string;
  a4_template_src?: string;
  elements?: any[];
  cover_preview_image: string;
}

export interface CafeStore {
  memoryBooks: Record<MemoryBookKey, MemoryEntry[]>;
  magazineEntries: MagazineEntry[];
  places: PlaceEntry[];
}

export function useCafeStore(): {
  store: CafeStore;
  memoryBooks: CafeStore['memoryBooks'];
  magazineEntries: MagazineEntry[];
  places: PlaceEntry[];
  isLoaded: boolean;
  error: string;
  load: () => Promise<void>;
  createMemory: (bookKey: MemoryBookKey, memory: Partial<MemoryEntry>) => Promise<MemoryEntry>;
  updateMemory: (bookKey: MemoryBookKey, memoryId: string, memory: Partial<MemoryEntry>) => Promise<void>;
  deleteMemory: (bookKey: MemoryBookKey, memoryId: string) => Promise<void>;
  createPlace: (place: Partial<PlaceEntry>) => Promise<PlaceEntry>;
  updatePlace: (placeId: string, place: Partial<PlaceEntry>) => Promise<void>;
  deletePlace: (placeId: string) => Promise<void>;
  createMagazine: (entry: Partial<MagazineEntry>) => Promise<MagazineEntry>;
  updateMagazine: (entryId: string, updates: Partial<MagazineEntry>) => Promise<void>;
  deleteMagazine: (entryId: string) => Promise<void>;
};
