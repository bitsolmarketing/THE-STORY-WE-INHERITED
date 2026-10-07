import { describe, expect, it } from 'vitest'
import { buildTimeline, odometer } from './timeline'
import { OPENING_CHAPTERS } from '@/data/story/chapters'
import { STORY_EVENTS } from '@/data/story/events'

const tl = buildTimeline({ opening: OPENING_CHAPTERS, events: STORY_EVENTS })

describe('timeline — event-locked chronology', () => {
  it('tells every storyboard beat exactly once, in storyboard order', () => {
    const told = tl.eventBeats.map((b) => b.id)
    expect(told).toEqual(STORY_EVENTS.filter((e) => e.presentation !== 'opening').map((e) => e.id))
    expect(tl.beats.some((b) => b.event?.id === 'E01')).toBe(true)
    expect(tl.beats.some((b) => b.event?.id === 'E02')).toBe(true)
  })

  it('never changes the year inside an event', () => {
    for (const b of tl.eventBeats) {
      for (const k of [0.001, 0.3, 0.6, 0.999]) {
        const p = b.start + (b.end - b.start) * k
        expect(tl.yearAt(p), `${b.id} @${k}`).toBe(b.year)
      }
    }
  })

  it('advances the year only inside transitions, monotonically', () => {
    let last = 0
    for (let i = 0; i <= 6000; i++) {
      const p = i / 6000
      const y = tl.yearAt(p)
      expect(y).toBeGreaterThanOrEqual(last - 1e-9)
      // Wherever we stand inside an event, the wheel shows exactly that event's year.
      const b = tl.beatAt(p)
      if (b.kind === 'event') expect(y).toBe(b.year)
      last = y
    }
    expect(last).toBe(2026)
  })

  it('separates every pair of events with a transition', () => {
    const chron = tl.beats.filter((b) => b.scene === 'chronicle' && b.kind !== 'epilogue')
    for (let i = 1; i < chron.length; i++) {
      if (chron[i].kind === 'event') expect(chron[i - 1].kind).toBe('transition')
    }
  })

  it('gives major events far more room than standard ones', () => {
    const major = tl.eventBeats.find((b) => b.importance === 'major')!
    const standard = tl.eventBeats.find((b) => b.importance === 'standard')!
    expect(major.seconds / standard.seconds).toBeGreaterThan(2.2)
  })

  it('plays the Judges’ Cut in about two minutes', () => {
    expect(tl.judgesTotalSeconds).toBeGreaterThan(108)
    expect(tl.judgesTotalSeconds).toBeLessThan(140)
    for (const s of [0, 10, 33.3, 77, tl.judgesTotalSeconds]) expect(tl.judgesTimeAt(tl.progressAtJudgesTime(s))).toBeCloseTo(s, 6)
  })

  it('is contiguous and normalized', () => {
    expect(tl.beats[0].start).toBe(0)
    expect(tl.beats[tl.beats.length - 1].end).toBe(1)
    for (let i = 1; i < tl.beats.length; i++) expect(tl.beats[i].start).toBeCloseTo(tl.beats[i - 1].end, 10)
    for (const b of tl.beats) expect(tl.beatAt((b.start + b.end) / 2).id).toBe(b.id)
  })
})

describe('odometer', () => {
  const read = (v: number) => odometer(v).map((d) => ((Math.round(d) % 10) + 10) % 10).join('')
  it('reads whole years exactly', () => {
    for (const y of [1947, 1948, 1999, 2000, 2026]) expect(read(y)).toBe(String(y))
  })
  it('turns higher wheels only as the lower wheel passes 9 → 0', () => {
    expect(odometer(1950.3)[2]).toBe(5)
    expect(odometer(1999.5)).toEqual([1.5, 9.5, 9.5, 9.5])
    expect(odometer(1998.5)[2]).toBe(9)
  })
})
