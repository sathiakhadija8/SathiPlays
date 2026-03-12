export const CLOSET_STATES = ['in_closet', 'dirty'] as const;

export type ClosetState = (typeof CLOSET_STATES)[number];

export function isClosetState(value: unknown): value is ClosetState {
  return typeof value === 'string' && CLOSET_STATES.includes(value as ClosetState);
}

export const OUTFIT_SLOT_TYPES = ['headwear', 'outerwear', 'top', 'bottom', 'dress', 'shoes', 'bag', 'accessory'] as const;
export type OutfitSlotType = (typeof OUTFIT_SLOT_TYPES)[number];

export function isOutfitSlotType(value: unknown): value is OutfitSlotType {
  return typeof value === 'string' && OUTFIT_SLOT_TYPES.includes(value as OutfitSlotType);
}
