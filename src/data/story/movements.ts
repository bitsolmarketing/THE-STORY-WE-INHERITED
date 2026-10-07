import type { MovementId } from './types'

/** The storyboard's 2-minute flow, as quiet chapter marks for the film. */
export const MOVEMENTS: Record<MovementId, { numeral: string; name: string }> = {
  prologue: { numeral: 'I', name: 'Prologue' },
  birth: { numeral: 'II', name: 'Birth' },
  survival: { numeral: 'III', name: 'Survival' },
  building: { numeral: 'IV', name: 'Building' },
  conflict: { numeral: 'V', name: 'Conflict' },
  loss: { numeral: 'VI', name: 'Loss' },
  rebuilding: { numeral: 'VII', name: 'Rebuilding' },
  achievement: { numeral: 'VIII', name: 'Achievement' },
  modern: { numeral: 'IX', name: 'Modern Pakistan' },
  diplomacy: { numeral: 'X', name: 'Diplomacy' },
  next: { numeral: 'XI', name: 'Next Chapter' },
}

/** Closing statement (storyboard cover). */
export const EPILOGUE_LINES = ['We inherited the story.', 'What we build next becomes history.'] as const
