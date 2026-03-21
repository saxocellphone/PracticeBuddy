import { vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock AudioParam
// ---------------------------------------------------------------------------

/** Minimal AudioParam mock with value tracking and automation stubs */
export interface MockAudioParam extends Partial<AudioParam> {
  value: number
  defaultValue: number
  setValueAtTime: ReturnType<typeof vi.fn>
  linearRampToValueAtTime: ReturnType<typeof vi.fn>
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>
}

function createMockAudioParam(defaultValue = 0): MockAudioParam {
  return {
    value: defaultValue,
    defaultValue,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  }
}

// ---------------------------------------------------------------------------
// Mock AudioNode
// ---------------------------------------------------------------------------

/** Minimal AudioNode mock that tracks connect/disconnect calls */
export interface MockAudioNode extends Partial<AudioNode> {
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

function createMockAudioNode(): MockAudioNode {
  const node: MockAudioNode = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
  // connect() returns the destination node (for chaining)
  node.connect.mockReturnValue(node)
  return node
}

// ---------------------------------------------------------------------------
// Mock OscillatorNode
// ---------------------------------------------------------------------------

/** Mock oscillator that records start/stop calls and exposes a frequency param */
export interface MockOscillatorNode extends MockAudioNode {
  frequency: MockAudioParam
  type: OscillatorType
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
}

function createMockOscillatorNode(): MockOscillatorNode {
  const base = createMockAudioNode()
  return {
    ...base,
    frequency: createMockAudioParam(440),
    type: 'sine',
    start: vi.fn(),
    stop: vi.fn(),
  }
}

// ---------------------------------------------------------------------------
// Mock GainNode
// ---------------------------------------------------------------------------

/** Mock gain node with a controllable gain AudioParam */
export interface MockGainNode extends MockAudioNode {
  gain: MockAudioParam
}

function createMockGainNode(): MockGainNode {
  return {
    ...createMockAudioNode(),
    gain: createMockAudioParam(1),
  }
}

// ---------------------------------------------------------------------------
// Mock AnalyserNode
// ---------------------------------------------------------------------------

/**
 * Mock AnalyserNode with injectable sample data.
 * Call `setSampleBuffer(buffer)` to control what `getFloatTimeDomainData` returns.
 */
export interface MockAnalyserNode extends MockAudioNode {
  fftSize: number
  frequencyBinCount: number
  smoothingTimeConstant: number
  getFloatTimeDomainData: ReturnType<typeof vi.fn>
  getByteFrequencyData: ReturnType<typeof vi.fn>
  /** Inject sample data that getFloatTimeDomainData will copy into the caller's array */
  setSampleBuffer(buffer: Float32Array): void
}

export function createMockAnalyserNode(): MockAnalyserNode {
  let sampleBuffer: Float32Array = new Float32Array(0)

  const node: MockAnalyserNode = {
    ...createMockAudioNode(),
    fftSize: 4096,
    get frequencyBinCount() {
      return this.fftSize / 2
    },
    smoothingTimeConstant: 0,
    getFloatTimeDomainData: vi.fn((array: Float32Array) => {
      const length = Math.min(array.length, sampleBuffer.length)
      for (let i = 0; i < length; i++) {
        array[i] = sampleBuffer[i]
      }
    }),
    getByteFrequencyData: vi.fn(),
    setSampleBuffer(buffer: Float32Array) {
      sampleBuffer = buffer
    },
  }

  return node
}

// ---------------------------------------------------------------------------
// Mock MediaStream
// ---------------------------------------------------------------------------

/** Create a mock MediaStream with one stoppable track */
export function createMockMediaStream(): MediaStream {
  const mockTrack = {
    stop: vi.fn(),
    kind: 'audio',
    id: 'mock-track-id',
    enabled: true,
    readyState: 'live' as MediaStreamTrackState,
  } as unknown as MediaStreamTrack

  return {
    getTracks: () => [mockTrack],
    getAudioTracks: () => [mockTrack],
    getVideoTracks: () => [],
    id: 'mock-stream-id',
    active: true,
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    clone: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
    onaddtrack: null,
    onremovetrack: null,
    onactive: null,
    oninactive: null,
    getTrackById: vi.fn(() => mockTrack),
  } as unknown as MediaStream
}

// ---------------------------------------------------------------------------
// Mock MediaStreamSource
// ---------------------------------------------------------------------------

function createMockMediaStreamSource(): MockAudioNode {
  return createMockAudioNode()
}

// ---------------------------------------------------------------------------
// Mock AudioContext
// ---------------------------------------------------------------------------

/**
 * Create a mock AudioContext with controllable currentTime.
 *
 * - `currentTime` starts at 0 and advances via `advanceTime(seconds)`
 * - `createOscillator()` returns mock oscillators (tracked in `createdOscillators`)
 * - `createGain()` returns a mock gain node
 * - `createAnalyser()` returns a mock AnalyserNode with injectable sample data
 * - `createMediaStreamSource()` returns a mock source node
 * - `close()` and `resume()` resolve immediately
 * - `destination` is a mock AudioNode
 */
export interface MockAudioContext extends Partial<AudioContext> {
  currentTime: number
  state: AudioContextState
  sampleRate: number
  /** Advance currentTime by the given number of seconds */
  advanceTime(seconds: number): void
  /** All oscillators created via createOscillator(), for verification */
  createdOscillators: MockOscillatorNode[]
  /** The mock analyser returned by createAnalyser() */
  mockAnalyser: MockAnalyserNode
  destination: MockAudioNode & Partial<AudioDestinationNode>
  createOscillator(): MockOscillatorNode
  createGain(): MockGainNode
  createAnalyser(): MockAnalyserNode
  createMediaStreamSource(stream: MediaStream): MockAudioNode
  close(): Promise<void>
  resume(): Promise<void>
  suspend(): Promise<void>
}

export function createMockAudioContext(): MockAudioContext {
  let time = 0
  const createdOscillators: MockOscillatorNode[] = []
  const mockAnalyser = createMockAnalyserNode()
  const destinationNode = createMockAudioNode() as MockAudioNode & Partial<AudioDestinationNode>

  const ctx: MockAudioContext = {
    get currentTime() {
      return time
    },
    set currentTime(_v: number) {
      // read-only from outside; use advanceTime
    },
    state: 'running',
    sampleRate: 44100,
    createdOscillators,
    mockAnalyser,
    destination: destinationNode,

    advanceTime(seconds: number) {
      time += seconds
    },

    createOscillator() {
      const osc = createMockOscillatorNode()
      createdOscillators.push(osc)
      return osc
    },

    createGain() {
      return createMockGainNode()
    },

    createAnalyser() {
      return mockAnalyser
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    createMediaStreamSource(_stream: MediaStream) {
      return createMockMediaStreamSource()
    },

    async close() {
      ctx.state = 'closed'
    },

    async resume() {
      ctx.state = 'running'
    },

    async suspend() {
      ctx.state = 'suspended'
    },
  }

  return ctx
}
