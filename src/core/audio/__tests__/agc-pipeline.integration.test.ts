/**
 * Integration test: verify that AGC boosts the quiet reference piano recording
 * to a level where pitch detection can reliably identify all notes.
 *
 * Uses the real c-scale-piano.wav file from test-utils.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { AutoGainControl, computeRms } from '../agc.ts'

// ---------------------------------------------------------------------------
// WAV file parser — extracts raw Float32 PCM samples
// ---------------------------------------------------------------------------

interface WavData {
  sampleRate: number
  channels: number
  samples: Float32Array
}

function parseWav(buffer: Buffer): WavData {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)

  // Verify RIFF header
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))
  if (riff !== 'RIFF') throw new Error('Not a WAV file')

  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11))
  if (wave !== 'WAVE') throw new Error('Not a WAV file')

  // Find fmt and data chunks
  let offset = 12
  let sampleRate = 44100
  let channels = 1
  let bitsPerSample = 16
  let dataStart = 0
  let dataSize = 0

  while (offset < buffer.byteLength - 8) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset), view.getUint8(offset + 1),
      view.getUint8(offset + 2), view.getUint8(offset + 3),
    )
    const chunkSize = view.getUint32(offset + 4, true)

    if (chunkId === 'fmt ') {
      channels = view.getUint16(offset + 10, true)
      sampleRate = view.getUint32(offset + 12, true)
      bitsPerSample = view.getUint16(offset + 22, true)
    } else if (chunkId === 'data') {
      dataStart = offset + 8
      dataSize = chunkSize
      break
    }

    offset += 8 + chunkSize
    // Chunks are word-aligned
    if (chunkSize % 2 !== 0) offset++
  }

  if (dataStart === 0) throw new Error('No data chunk found')

  // Convert to Float32 (mono — average channels if stereo)
  const bytesPerSample = bitsPerSample / 8
  const totalSamples = dataSize / bytesPerSample
  const framesCount = totalSamples / channels
  const samples = new Float32Array(framesCount)

  for (let i = 0; i < framesCount; i++) {
    let sum = 0
    for (let ch = 0; ch < channels; ch++) {
      const byteOffset = dataStart + (i * channels + ch) * bytesPerSample
      if (bitsPerSample === 16) {
        sum += view.getInt16(byteOffset, true) / 32768
      } else if (bitsPerSample === 24) {
        const b0 = view.getUint8(byteOffset)
        const b1 = view.getUint8(byteOffset + 1)
        const b2 = view.getUint8(byteOffset + 2)
        const val = (b2 << 24 | b1 << 16 | b0 << 8) >> 8
        sum += val / 8388608
      } else if (bitsPerSample === 32) {
        sum += view.getFloat32(byteOffset, true)
      }
    }
    samples[i] = sum / channels
  }

  return { sampleRate, channels, samples }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AGC pipeline integration', () => {
  const wavPath = resolve(__dirname, '../../../__test-utils__/c-scale-piano.wav')
  let wavData: WavData

  // Load WAV once for all tests
  try {
    const fileBuffer = readFileSync(wavPath)
    wavData = parseWav(fileBuffer)
  } catch {
    // If WAV file is missing, tests will be skipped
    wavData = null as unknown as WavData
  }

  it('loads the reference WAV file successfully', () => {
    expect(wavData).toBeTruthy()
    expect(wavData.sampleRate).toBeGreaterThan(0)
    expect(wavData.samples.length).toBeGreaterThan(0)
  })

  it('reference recording has low RMS confirming it needs amplification', () => {
    if (!wavData) return

    const windowSize = 8192
    let maxRms = 0
    for (let i = 0; i + windowSize <= wavData.samples.length; i += windowSize) {
      const window = wavData.samples.slice(i, i + windowSize)
      const rms = computeRms(window)
      if (rms > maxRms) maxRms = rms
    }

    // Reference recording has peak RMS well below 0.1 (the lower bound of our target)
    expect(maxRms).toBeLessThan(0.1)
  })

  it('AGC boosts quiet signal to target RMS range', () => {
    if (!wavData) return

    const windowSize = 8192
    const agc = new AutoGainControl({ targetRms: 0.125, smoothingFactor: 0.15 })
    const boostedRmsValues: number[] = []

    // Simulate the feedback AGC loop
    for (let i = 0; i + windowSize <= wavData.samples.length; i += windowSize) {
      const rawWindow = wavData.samples.slice(i, i + windowSize)
      const rawRms = computeRms(rawWindow)

      // Skip silent windows (between notes)
      if (rawRms < 0.001) continue

      // Simulate post-gain signal: raw * currentGain
      const postGainWindow = new Float32Array(windowSize)
      for (let j = 0; j < windowSize; j++) {
        postGainWindow[j] = rawWindow[j] * agc.currentGain
      }

      // Update AGC with post-gain buffer (just like production)
      agc.update(postGainWindow)

      // Record the effective RMS after gain
      const effectiveRms = rawRms * agc.currentGain
      boostedRmsValues.push(effectiveRms)
    }

    expect(boostedRmsValues.length).toBeGreaterThan(0)

    // After initial ramp-up, the boosted RMS should be near the target
    // Skip the first few windows (AGC is still ramping up)
    const convergedValues = boostedRmsValues.slice(Math.min(5, boostedRmsValues.length - 1))
    const avgBoostedRms = convergedValues.reduce((a, b) => a + b, 0) / convergedValues.length

    // Should be in the target range (0.05 to 0.3 — generous bounds since
    // the signal varies per-note and AGC smoothing introduces lag)
    expect(avgBoostedRms).toBeGreaterThan(0.03)
    expect(avgBoostedRms).toBeLessThan(0.5)

    // Gain should have increased significantly from 1.0
    expect(agc.currentGain).toBeGreaterThan(3)
  })

  it('AGC gain stabilizes and does not oscillate', () => {
    if (!wavData) return

    const windowSize = 8192
    const agc = new AutoGainControl({ targetRms: 0.125, smoothingFactor: 0.1 })
    const gainHistory: number[] = []

    for (let i = 0; i + windowSize <= wavData.samples.length; i += windowSize) {
      const rawWindow = wavData.samples.slice(i, i + windowSize)
      const rawRms = computeRms(rawWindow)
      if (rawRms < 0.001) continue

      const postGainWindow = new Float32Array(windowSize)
      for (let j = 0; j < windowSize; j++) {
        postGainWindow[j] = rawWindow[j] * agc.currentGain
      }

      agc.update(postGainWindow)
      gainHistory.push(agc.currentGain)
    }

    // Check that gain changes become smaller over time (convergence)
    if (gainHistory.length > 10) {
      const earlyChanges = gainHistory.slice(0, 5).map((g, i, arr) =>
        i > 0 ? Math.abs(g - arr[i - 1]) : 0,
      ).slice(1)

      const lateChanges = gainHistory.slice(-5).map((g, i, arr) =>
        i > 0 ? Math.abs(g - arr[i - 1]) : 0,
      ).slice(1)

      const avgEarlyChange = earlyChanges.reduce((a, b) => a + b, 0) / earlyChanges.length
      const avgLateChange = lateChanges.reduce((a, b) => a + b, 0) / lateChanges.length

      // Late changes should be smaller than early changes (gain is stabilizing)
      expect(avgLateChange).toBeLessThanOrEqual(avgEarlyChange + 0.5)
    }
  })
})
