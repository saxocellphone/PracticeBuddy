import { describe, it, expect } from 'vitest'
import { AutoGainControl, computeRms } from '../agc.ts'

function makeSineBuffer(amplitude: number, frequency: number, sampleRate = 44100, size = 8192): Float32Array {
  const buf = new Float32Array(size)
  for (let i = 0; i < size; i++) {
    buf[i] = amplitude * Math.sin(2 * Math.PI * frequency * i / sampleRate)
  }
  return buf
}

function makeConstantBuffer(amplitude: number, size = 8192): Float32Array {
  const buf = new Float32Array(size)
  buf.fill(amplitude)
  return buf
}

describe('computeRms', () => {
  it('returns 0 for a silent buffer', () => {
    const buf = new Float32Array(1024)
    expect(computeRms(buf)).toBe(0)
  })

  it('returns the correct RMS for a constant signal', () => {
    const buf = makeConstantBuffer(0.5, 1024)
    expect(computeRms(buf)).toBeCloseTo(0.5, 5)
  })

  it('returns amplitude / sqrt(2) for a sine wave', () => {
    const amplitude = 0.3
    const buf = makeSineBuffer(amplitude, 440, 44100, 44100) // full seconds for accuracy
    expect(computeRms(buf)).toBeCloseTo(amplitude / Math.SQRT2, 3)
  })
})

describe('AutoGainControl', () => {
  it('starts at gain 1.0', () => {
    const agc = new AutoGainControl()
    expect(agc.currentGain).toBe(1.0)
  })

  it('amplifies a quiet signal', () => {
    const agc = new AutoGainControl()
    // Simulate a quiet signal (RMS ~0.007, similar to reference piano)
    const quietBuffer = makeSineBuffer(0.01, 262, 44100, 8192)

    // Run several updates — gain should increase
    for (let i = 0; i < 50; i++) {
      agc.update(quietBuffer)
    }

    expect(agc.currentGain).toBeGreaterThan(1.0)
  })

  it('converges toward target RMS over many updates', () => {
    const targetRms = 0.125
    const agc = new AutoGainControl({ targetRms, smoothingFactor: 0.2 })
    const rawAmplitude = 0.01
    const rawRms = rawAmplitude / Math.SQRT2 // ~0.00707

    // Simulate feedback loop: post-gain buffer RMS = rawRms * currentGain
    for (let i = 0; i < 200; i++) {
      const postGainAmplitude = rawAmplitude * agc.currentGain
      const postGainBuffer = makeSineBuffer(postGainAmplitude, 262, 44100, 8192)
      agc.update(postGainBuffer)
    }

    // After convergence: currentGain * rawRms ≈ targetRms
    const effectiveRms = agc.currentGain * rawRms
    expect(effectiveRms).toBeCloseTo(targetRms, 1)
  })

  it('never attenuates below minGain (1.0) for loud signals', () => {
    const agc = new AutoGainControl()
    // Loud signal with RMS well above target
    const loudBuffer = makeSineBuffer(0.5, 440, 44100, 8192)

    for (let i = 0; i < 50; i++) {
      agc.update(loudBuffer)
    }

    expect(agc.currentGain).toBe(1.0)
  })

  it('holds gain steady during silence', () => {
    const agc = new AutoGainControl({ smoothingFactor: 0.2 })
    // First, establish a gain > 1 with a quiet signal
    const quietBuffer = makeSineBuffer(0.01, 262, 44100, 8192)
    for (let i = 0; i < 50; i++) {
      agc.update(quietBuffer)
    }
    const gainBeforeSilence = agc.currentGain
    expect(gainBeforeSilence).toBeGreaterThan(1.0)

    // Now feed silence — gain should hold
    const silentBuffer = new Float32Array(8192)
    for (let i = 0; i < 20; i++) {
      agc.update(silentBuffer)
    }

    expect(agc.currentGain).toBe(gainBeforeSilence)
  })

  it('caps gain at maxGain', () => {
    const maxGain = 20
    const agc = new AutoGainControl({ maxGain, smoothingFactor: 0.5 })
    // Extremely quiet signal
    const tinyBuffer = makeSineBuffer(0.0001, 262, 44100, 8192)

    for (let i = 0; i < 200; i++) {
      agc.update(tinyBuffer)
    }

    expect(agc.currentGain).toBeLessThanOrEqual(maxGain)
  })

  it('applies EMA smoothing — gain does not jump instantly', () => {
    const agc = new AutoGainControl({ smoothingFactor: 0.1 })
    const quietBuffer = makeSineBuffer(0.01, 262, 44100, 8192)

    const firstGain = agc.update(quietBuffer)

    // With smoothingFactor=0.1, the first step should move only 10% toward the target
    // Target gain for RMS ~0.007 and targetRms 0.125 would be ~17.7
    // First step: 1.0 + 0.1 * (17.7 - 1.0) ≈ 2.67
    expect(firstGain).toBeLessThan(5)
    expect(firstGain).toBeGreaterThan(1.0)
  })

  it('reset() returns gain to 1.0', () => {
    const agc = new AutoGainControl({ smoothingFactor: 0.2 })
    const quietBuffer = makeSineBuffer(0.01, 262, 44100, 8192)

    for (let i = 0; i < 30; i++) {
      agc.update(quietBuffer)
    }
    expect(agc.currentGain).toBeGreaterThan(1.0)

    agc.reset()
    expect(agc.currentGain).toBe(1.0)
  })

  it('respects custom config values', () => {
    const agc = new AutoGainControl({
      targetRms: 0.2,
      maxGain: 5,
      minGain: 2.0,
      smoothingFactor: 0.5,
      silenceThreshold: 0.01,
    })

    // Signal with RMS below silenceThreshold should be treated as silence
    const nearSilent = makeSineBuffer(0.005, 262, 44100, 8192) // RMS ~0.0035
    agc.update(nearSilent)
    expect(agc.currentGain).toBe(1.0) // below minGain=2 but starts at 1.0...
    // Actually, the first update with a signal just above silence threshold
    // should move gain toward minGain
    const audibleBuffer = makeSineBuffer(0.05, 262, 44100, 8192)
    for (let i = 0; i < 100; i++) {
      agc.update(audibleBuffer)
    }
    // Gain should be at least minGain
    expect(agc.currentGain).toBeGreaterThanOrEqual(2.0)
    // And capped at maxGain
    expect(agc.currentGain).toBeLessThanOrEqual(5)
  })
})
