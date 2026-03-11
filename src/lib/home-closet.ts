export const CLOSET_STATES = ['in_closet', 'dirty', 'in_laundry', 'drying', 'folded'] as const;

export type ClosetState = (typeof CLOSET_STATES)[number];

export function isClosetState(value: unknown): value is ClosetState {
  return typeof value === 'string' && CLOSET_STATES.includes(value as ClosetState);
}
