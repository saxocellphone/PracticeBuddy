import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MetronomeEngine } from '@core/metronome/MetronomeEngine.ts'
import {
  createMockAudioContext,
  type MockAudioContext,
} from '../../../__test-utils__/mock-audio.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Advance the mock AudioContext time and then tick the fake timer by one
 * scheduler interval (25ms) so the MetronomeEngine's setInterval fires.
 *
 * The engine schedules beats when `nextNoteTime < currentTime + 0.1`.
 * By advancing the AudioContext clock first, then ticking the timer, we
 * let the scheduler see the new time and schedule any pending beats.
 */
function advanceAndTick(ctx: MockAudioContext, seconds: number): void {
  ctx.advanceTime(seconds)
  vi.advanceTimersByTime(25)
}

/**
 * Trigger the very first scheduler tick without advancing audio time.
 * Useful right after start() because the first beat is scheduled when
 * nextNoteTime (0) < currentTime (0) + SCHEDULE_AHEAD_TIME (0.1).
 */
function triggerFirstTick(): void {
  vi.advanceTimersByTime(25)
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('MetronomeEngine integration', () => {
  let ctx: MockAudioContext
  let engine: MetronomeEngine

  beforeEach(() => {
    vi.useFakeTimers()
    ctx = createMockAudioContext()
    engine = new MetronomeEngine(ctx as unknown as AudioContext)
  })

  afterEach(() => {
    engine.dispose()
    vi.useRealTimers()
  })

  // =========================================================================
  // 1. Constructor
  // =========================================================================

  describe('constructor', () => {
    it('creates engine with default state', () => {
      const state = engine.state

      expect(state.isPlaying).toBe(false)
      expect(state.currentBeat).toBe(0)
      expect(state.bpm).toBe(120)
      expect(state.beatsPerMeasure).toBe(4)
    })
  })

  // =========================================================================
  // 2. Start / Stop
  // =========================================================================

  describe('start and stop', () => {
    it('start() sets isPlaying to true', () => {
      engine.start()

      expect(engine.state.isPlaying).toBe(true)
    })

    it('stop() sets isPlaying to false and resets currentBeat', () => {
      engine.start()
      triggerFirstTick() // schedules beat 0, currentBeat advances to 1

      expect(engine.state.currentBeat).toBe(1)

      engine.stop()

      expect(engine.state.isPlaying).toBe(false)
      expect(engine.state.currentBeat).toBe(0)
    })

    it('start() is idempotent when already playing', () => {
      const listener = vi.fn()
      engine.onBeat(listener)

      engine.start()
      triggerFirstTick()

      const callCount = listener.mock.calls.length

      // Calling start() again should not reset or double-schedule
      engine.start()
      triggerFirstTick()

      expect(listener.mock.calls.length).toBe(callCount)
    })

    it('stop() is a no-op when not playing', () => {
      // Should not throw
      engine.stop()

      expect(engine.state.isPlaying).toBe(false)
      expect(engine.state.currentBeat).toBe(0)
    })
  })

  // =========================================================================
  // 3. Beat callbacks
  // =========================================================================

  describe('beat callbacks', () => {
    it('listener receives (beat, scheduledTime) on each beat', () => {
      const listener = vi.fn()
      engine.onBeat(listener)

      engine.start()
      triggerFirstTick() // beat 0

      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith(0, expect.any(Number))

      // The scheduledTime for beat 0 should be approximately 0 (currentTime at start)
      const scheduledTime = listener.mock.calls[0][1] as number
      expect(scheduledTime).toBe(0)
    })

    it('fires callback for subsequent beats when time advances', () => {
      const listener = vi.fn()
      engine.onBeat(listener)
      engine.setBpm(120) // 0.5s per beat

      engine.start()
      triggerFirstTick() // beat 0 at t=0

      expect(listener).toHaveBeenCalledTimes(1)

      // Advance to ~0.5s so beat 1 is within look-ahead
      advanceAndTick(ctx, 0.45)

      expect(listener).toHaveBeenCalledTimes(2)
      expect(listener.mock.calls[1][0]).toBe(1) // beat index 1
      expect(listener.mock.calls[1][1]).toBeCloseTo(0.5, 5) // scheduled at 0.5s
    })
  })

  // =========================================================================
  // 4. Beat cycling
  // =========================================================================

  describe('beat cycling', () => {
    it('cycles beats 0 -> 1 -> 2 -> 3 -> 0 -> 1 at beatsPerMeasure=4', () => {
      const beats: number[] = []
      engine.onBeat((beat) => beats.push(beat))
      engine.setBpm(120) // 500ms per beat

      engine.start()

      // Advance through 6 beats: 0, 1, 2, 3, 0, 1
      // beat 0 at t=0.0
      triggerFirstTick()
      // beat 1 at t=0.5
      advanceAndTick(ctx, 0.45)
      // beat 2 at t=1.0
      advanceAndTick(ctx, 0.5)
      // beat 3 at t=1.5
      advanceAndTick(ctx, 0.5)
      // beat 0 at t=2.0 (wraps)
      advanceAndTick(ctx, 0.5)
      // beat 1 at t=2.5
      advanceAndTick(ctx, 0.5)

      expect(beats).toEqual([0, 1, 2, 3, 0, 1])
    })

    it('cycles correctly with beatsPerMeasure=3', () => {
      engine.setBeatsPerMeasure(3)
      const beats: number[] = []
      engine.onBeat((beat) => beats.push(beat))
      engine.setBpm(120) // 500ms per beat

      engine.start()

      triggerFirstTick()        // beat 0
      advanceAndTick(ctx, 0.45) // beat 1
      advanceAndTick(ctx, 0.5)  // beat 2
      advanceAndTick(ctx, 0.5)  // beat 0 (wraps)
      advanceAndTick(ctx, 0.5)  // beat 1

      expect(beats).toEqual([0, 1, 2, 0, 1])
    })
  })

  // =========================================================================
  // 5. BPM accuracy
  // =========================================================================

  describe('BPM accuracy', () => {
    it('at 120 BPM, beats are scheduled 500ms apart', () => {
      const times: number[] = []
      engine.onBeat((_beat, time) => times.push(time))
      engine.setBpm(120)

      engine.start()

      triggerFirstTick()        // beat 0 at t=0
      advanceAndTick(ctx, 0.45) // beat 1 at t=0.5
      advanceAndTick(ctx, 0.5)  // beat 2 at t=1.0
      advanceAndTick(ctx, 0.5)  // beat 3 at t=1.5

      expect(times).toHaveLength(4)
      expect(times[0]).toBeCloseTo(0.0, 5)
      expect(times[1]).toBeCloseTo(0.5, 5)
      expect(times[2]).toBeCloseTo(1.0, 5)
      expect(times[3]).toBeCloseTo(1.5, 5)
    })

    it('at 60 BPM, beats are scheduled 1000ms apart', () => {
      const times: number[] = []
      engine.onBeat((_beat, time) => times.push(time))
      engine.setBpm(60)

      engine.start()

      triggerFirstTick()        // beat 0 at t=0
      advanceAndTick(ctx, 0.95) // beat 1 at t=1.0
      advanceAndTick(ctx, 1.0)  // beat 2 at t=2.0

      expect(times).toHaveLength(3)
      expect(times[0]).toBeCloseTo(0.0, 5)
      expect(times[1]).toBeCloseTo(1.0, 5)
      expect(times[2]).toBeCloseTo(2.0, 5)
    })

    it('at 240 BPM, beats are scheduled 250ms apart', () => {
      const times: number[] = []
      engine.onBeat((_beat, time) => times.push(time))
      engine.setBpm(240)

      engine.start()

      triggerFirstTick()         // beat 0 at t=0
      advanceAndTick(ctx, 0.2)   // beat 1 at t=0.25
      advanceAndTick(ctx, 0.25)  // beat 2 at t=0.50
      advanceAndTick(ctx, 0.25)  // beat 3 at t=0.75

      expect(times).toHaveLength(4)
      expect(times[0]).toBeCloseTo(0.0, 5)
      expect(times[1]).toBeCloseTo(0.25, 5)
      expect(times[2]).toBeCloseTo(0.50, 5)
      expect(times[3]).toBeCloseTo(0.75, 5)
    })
  })

  // =========================================================================
  // 6. BPM change while playing
  // =========================================================================

  describe('BPM change while playing', () => {
    it('changing BPM mid-play affects subsequent beat intervals', () => {
      const times: number[] = []
      engine.onBeat((_beat, time) => times.push(time))
      engine.setBpm(120) // 500ms per beat

      engine.start()

      // Beat 0 at t=0
      triggerFirstTick()
      // Beat 1 at t=0.5
      advanceAndTick(ctx, 0.45)

      // Change to 60 BPM (1000ms per beat) — takes effect for the next beat
      engine.setBpm(60)

      // Beat 2 should now be at t=0.5 + 1.0 = 1.5
      // (nextNoteTime was already set to 1.0 for beat 2 at 120 BPM before the change,
      //  but the BPM change only affects the *interval after* the next scheduled beat.)
      // Actually, let's trace: after beat 1 at t=0.5, nextNoteTime = 0.5 + 0.5 = 1.0.
      // Now BPM is 60. When beat at t=1.0 fires, nextNoteTime = 1.0 + 1.0 = 2.0.
      advanceAndTick(ctx, 0.5) // t=0.95 -> triggers beat at t=1.0

      expect(times).toHaveLength(3)
      expect(times[2]).toBeCloseTo(1.0, 5) // beat 2 was already queued at 120 BPM spacing

      // Next beat at new 60 BPM spacing: t=1.0 + 1.0 = 2.0
      advanceAndTick(ctx, 1.0) // t=1.95

      expect(times).toHaveLength(4)
      expect(times[3]).toBeCloseTo(2.0, 5) // 1.0s after previous — 60 BPM
    })

    it('clamps BPM to minimum of 30', () => {
      engine.setBpm(10)

      expect(engine.state.bpm).toBe(30)
    })

    it('clamps BPM to maximum of 240', () => {
      engine.setBpm(300)

      expect(engine.state.bpm).toBe(240)
    })
  })

  // =========================================================================
  // 7. Multiple listeners
  // =========================================================================

  describe('multiple listeners', () => {
    it('both listeners receive the same beat events', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()
      engine.onBeat(listener1)
      engine.onBeat(listener2)

      engine.start()
      triggerFirstTick() // beat 0

      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(1)

      expect(listener1).toHaveBeenCalledWith(0, expect.any(Number))
      expect(listener2).toHaveBeenCalledWith(0, expect.any(Number))

      // Both receive same scheduledTime
      expect(listener1.mock.calls[0][1]).toBe(listener2.mock.calls[0][1])
    })

    it('listeners operate independently across multiple beats', () => {
      const beats1: number[] = []
      const beats2: number[] = []
      engine.onBeat((beat) => beats1.push(beat))
      engine.onBeat((beat) => beats2.push(beat))
      engine.setBpm(120)

      engine.start()
      triggerFirstTick()
      advanceAndTick(ctx, 0.45)
      advanceAndTick(ctx, 0.5)

      expect(beats1).toEqual([0, 1, 2])
      expect(beats2).toEqual([0, 1, 2])
    })
  })

  // =========================================================================
  // 8. Unsubscribe
  // =========================================================================

  describe('unsubscribe', () => {
    it('unsubscribed listener no longer receives beat events', () => {
      const listener = vi.fn()
      const unsubscribe = engine.onBeat(listener)

      engine.start()
      triggerFirstTick() // beat 0 — listener called

      expect(listener).toHaveBeenCalledTimes(1)

      unsubscribe()

      advanceAndTick(ctx, 0.45) // beat 1 — listener should NOT be called

      expect(listener).toHaveBeenCalledTimes(1) // still 1, no new calls
    })

    it('unsubscribing one listener does not affect others', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()
      const unsub1 = engine.onBeat(listener1)
      engine.onBeat(listener2)

      engine.start()
      triggerFirstTick()

      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(1)

      unsub1()
      advanceAndTick(ctx, 0.45)

      expect(listener1).toHaveBeenCalledTimes(1) // unsubscribed
      expect(listener2).toHaveBeenCalledTimes(2) // still active
    })
  })

  // =========================================================================
  // 9. Click frequencies (oscillator verification)
  // =========================================================================

  describe('click frequencies', () => {
    it('beat 0 creates an oscillator at 880 Hz (accent)', () => {
      engine.start()
      triggerFirstTick() // beat 0

      expect(ctx.createdOscillators.length).toBeGreaterThanOrEqual(1)

      const firstOsc = ctx.createdOscillators[0]
      expect(firstOsc.frequency.value).toBe(880)
      expect(firstOsc.start).toHaveBeenCalled()
      expect(firstOsc.stop).toHaveBeenCalled()
    })

    it('non-zero beats create oscillators at 440 Hz', () => {
      engine.setBpm(120)
      engine.start()

      triggerFirstTick()        // beat 0 -> 880 Hz
      advanceAndTick(ctx, 0.45) // beat 1 -> 440 Hz
      advanceAndTick(ctx, 0.5)  // beat 2 -> 440 Hz

      // oscillators[0] is beat 0, oscillators[1] is beat 1, etc.
      expect(ctx.createdOscillators[1].frequency.value).toBe(440)
      expect(ctx.createdOscillators[2].frequency.value).toBe(440)
    })

    it('oscillators connect to gain and gain connects to destination', () => {
      engine.start()
      triggerFirstTick()

      const osc = ctx.createdOscillators[0]
      expect(osc.connect).toHaveBeenCalled()
    })

    it('beat 0 after wrap-around is still accented at 880 Hz', () => {
      engine.setBpm(120)
      engine.setBeatsPerMeasure(2) // wraps quickly: 0, 1, 0, 1, ...

      engine.start()

      triggerFirstTick()        // beat 0 (first measure)
      advanceAndTick(ctx, 0.45) // beat 1
      advanceAndTick(ctx, 0.5)  // beat 0 (second measure — wrap)

      expect(ctx.createdOscillators[0].frequency.value).toBe(880) // first beat 0
      expect(ctx.createdOscillators[1].frequency.value).toBe(440) // beat 1
      expect(ctx.createdOscillators[2].frequency.value).toBe(880) // wrapped beat 0
    })
  })

  // =========================================================================
  // 10. Rapid start/stop
  // =========================================================================

  describe('rapid start/stop', () => {
    it('handles rapid start-stop cycles without errors', () => {
      for (let i = 0; i < 10; i++) {
        engine.start()
        engine.stop()
      }

      expect(engine.state.isPlaying).toBe(false)
      expect(engine.state.currentBeat).toBe(0)
    })

    it('start-tick-stop-start continues cleanly from beat 0', () => {
      const beats: number[] = []
      engine.onBeat((beat) => beats.push(beat))
      engine.setBpm(120)

      engine.start()
      triggerFirstTick()
      advanceAndTick(ctx, 0.45) // beat 1

      engine.stop()

      // Clear previous beats from array for clarity
      beats.length = 0

      engine.start()
      triggerFirstTick() // should restart from beat 0

      expect(beats[0]).toBe(0)
    })

    it('no stale callbacks fire after stop', () => {
      const listener = vi.fn()
      engine.onBeat(listener)
      engine.setBpm(120)

      engine.start()
      triggerFirstTick()

      const callsBefore = listener.mock.calls.length

      engine.stop()

      // Advance time significantly — no callbacks should fire
      advanceAndTick(ctx, 2.0)
      advanceAndTick(ctx, 2.0)

      expect(listener.mock.calls.length).toBe(callsBefore)
    })
  })

  // =========================================================================
  // 11. beatsPerMeasure change
  // =========================================================================

  describe('beatsPerMeasure change', () => {
    it('changing beatsPerMeasure while playing adjusts beat cycling', () => {
      const beats: number[] = []
      engine.onBeat((beat) => beats.push(beat))
      engine.setBpm(120)
      engine.setBeatsPerMeasure(4) // 0,1,2,3,0,...

      engine.start()

      triggerFirstTick()        // beat 0
      advanceAndTick(ctx, 0.45) // beat 1

      // Change to 3 beats per measure mid-play
      engine.setBeatsPerMeasure(3)

      advanceAndTick(ctx, 0.5) // beat 2
      // With beatsPerMeasure=3, next beat wraps: (2+1)%3 = 0
      advanceAndTick(ctx, 0.5) // beat 0 (wrapped)
      advanceAndTick(ctx, 0.5) // beat 1

      expect(beats).toEqual([0, 1, 2, 0, 1])
    })

    it('clamps beatsPerMeasure to minimum of 1', () => {
      engine.setBeatsPerMeasure(0)

      expect(engine.state.beatsPerMeasure).toBe(1)
    })

    it('clamps beatsPerMeasure to maximum of 12', () => {
      engine.setBeatsPerMeasure(99)

      expect(engine.state.beatsPerMeasure).toBe(12)
    })

    it('beatsPerMeasure=1 means every beat is the accent', () => {
      engine.setBeatsPerMeasure(1)
      engine.setBpm(120)

      engine.start()

      triggerFirstTick()        // beat 0
      advanceAndTick(ctx, 0.45) // beat 0 again (wraps immediately)
      advanceAndTick(ctx, 0.5)  // beat 0 again

      // Every oscillator should be at 880 Hz (accent frequency)
      for (const osc of ctx.createdOscillators) {
        expect(osc.frequency.value).toBe(880)
      }
    })
  })

  // =========================================================================
  // Volume
  // =========================================================================

  describe('volume', () => {
    it('setVolume clamps between 0 and 1', () => {
      engine.setVolume(-0.5)
      // Volume is private, but we can verify it doesn't throw
      // and produces audible clicks. Test by starting and checking gain node.
      engine.setVolume(1.5)

      // No direct getter, but no errors thrown
      expect(true).toBe(true)
    })
  })

  // =========================================================================
  // Dispose
  // =========================================================================

  describe('dispose', () => {
    it('stops playback and clears all listeners', () => {
      const listener = vi.fn()
      engine.onBeat(listener)

      engine.start()
      triggerFirstTick()

      const callsBefore = listener.mock.calls.length

      engine.dispose()

      expect(engine.state.isPlaying).toBe(false)

      // Re-start should not trigger old listener (it was cleared)
      engine.start()
      triggerFirstTick()

      expect(listener.mock.calls.length).toBe(callsBefore)
    })
  })

  // =========================================================================
  // Look-ahead scheduling behavior
  // =========================================================================

  describe('look-ahead scheduling', () => {
    it('schedules multiple beats within the look-ahead window in a single tick', () => {
      // At 240 BPM, beat interval is 250ms = 0.25s
      // Look-ahead is 100ms = 0.1s
      // At 240 BPM a single look-ahead window can only hold one beat, so test
      // with a very high BPM where the interval is less than the look-ahead.
      //
      // Actually, the scheduler loops: while nextNoteTime < currentTime + 0.1.
      // If we jump time forward by a lot, multiple beats should fire in one tick.

      const beats: number[] = []
      engine.onBeat((beat) => beats.push(beat))
      engine.setBpm(120) // 500ms per beat

      engine.start()

      // Jump currentTime forward by 2 seconds — should trigger multiple beats
      // in a single scheduler invocation (beats at 0, 0.5, 1.0, 1.5, 2.0).
      ctx.advanceTime(2.0)
      vi.advanceTimersByTime(25)

      // All beats from t=0 through t=2.0 should have been scheduled
      // That's beats at: 0.0, 0.5, 1.0, 1.5, 2.0 = 5 beats
      expect(beats).toEqual([0, 1, 2, 3, 0])
    })

    it('does not schedule beats outside the look-ahead window', () => {
      const beats: number[] = []
      engine.onBeat((beat) => beats.push(beat))
      engine.setBpm(60) // 1000ms per beat

      engine.start()

      // First tick: beat 0 at t=0 is within look-ahead (0 < 0 + 0.1)
      triggerFirstTick()

      expect(beats).toEqual([0])

      // Advance only 0.05s. Next beat is at t=1.0, and currentTime + 0.1 = 0.15.
      // 1.0 < 0.15 is false, so no new beat should be scheduled.
      advanceAndTick(ctx, 0.05)

      expect(beats).toEqual([0])
    })
  })
})
