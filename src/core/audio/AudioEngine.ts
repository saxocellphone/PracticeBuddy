export type AudioEngineState =
  | 'uninitialized'
  | 'requesting-permission'
  | 'ready'
  | 'suspended'
  | 'error'

export class AudioEngine {
  private _state: AudioEngineState = 'uninitialized'
  private _audioContext: AudioContext | null = null
  private _analyserNode: AnalyserNode | null = null
  private _mediaStream: MediaStream | null = null
  private _stateListeners: Set<(state: AudioEngineState) => void> = new Set()

  get state(): AudioEngineState {
    return this._state
  }

  get audioContext(): AudioContext | null {
    return this._audioContext
  }

  get analyserNode(): AnalyserNode | null {
    return this._analyserNode
  }

  get sampleRate(): number {
    return this._audioContext?.sampleRate ?? 44100
  }

  onStateChange(callback: (state: AudioEngineState) => void): () => void {
    this._stateListeners.add(callback)
    return () => this._stateListeners.delete(callback)
  }

  private setState(newState: AudioEngineState): void {
    this._state = newState
    this._stateListeners.forEach((cb) => cb(newState))
  }

  async initialize(): Promise<void> {
    if (this._state === 'ready') return

    this.setState('requesting-permission')

    try {
      this._mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })

      this._audioContext = new AudioContext()
      const source = this._audioContext.createMediaStreamSource(this._mediaStream)

      this._analyserNode = this._audioContext.createAnalyser()
      this._analyserNode.fftSize = 8192
      this._analyserNode.smoothingTimeConstant = 0

      source.connect(this._analyserNode)

      // Handle browser autoplay policy
      if (this._audioContext.state === 'suspended') {
        await this._audioContext.resume()
      }

      this.setState('ready')
    } catch (error) {
      console.error('AudioEngine initialization failed:', error)
      this.setState('error')
      throw error
    }
  }

  async suspend(): Promise<void> {
    if (this._audioContext && this._audioContext.state === 'running') {
      await this._audioContext.suspend()
      this.setState('suspended')
    }
  }

  async resume(): Promise<void> {
    if (this._audioContext && this._audioContext.state === 'suspended') {
      await this._audioContext.resume()
      this.setState('ready')
    }
  }

  dispose(): void {
    if (this._mediaStream) {
      this._mediaStream.getTracks().forEach((track) => track.stop())
      this._mediaStream = null
    }
    if (this._audioContext) {
      this._audioContext.close()
      this._audioContext = null
    }
    this._analyserNode = null
    this.setState('uninitialized')
  }
}
