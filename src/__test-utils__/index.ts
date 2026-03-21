/**
 * Shared test infrastructure for PracticeBuddy integration tests.
 *
 * @example
 * ```ts
 * import {
 *   createMockAudioContext,
 *   setupWasmMocks,
 *   installMockRAF,
 *   makeNote,
 *   makePitch,
 * } from '@/src/__test-utils__'
 * ```
 */
export {
  createMockAudioContext,
  createMockAnalyserNode,
  createMockMediaStream,
  type MockAudioContext,
  type MockAnalyserNode,
  type MockOscillatorNode,
  type MockGainNode,
  type MockAudioNode,
  type MockAudioParam,
} from './mock-audio.ts'

export {
  setupWasmMocks,
  type WasmMockControls,
} from './mock-wasm.ts'

export {
  installMockRAF,
  type RAFController,
} from './mock-raf.ts'

export {
  makePitch,
  makeNote,
  makeSample,
  makeTestSequence,
  simulateBeats,
  TEST_TIMING_WINDOWS,
} from './helpers.ts'
