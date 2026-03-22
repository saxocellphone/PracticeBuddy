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
  private _gainNode: GainNode | null = null
  private _sourceNode: MediaStreamAudioSourceNode | null = null
  private _mediaStream: MediaStream | null = null
  private _stateListeners: Set<(state: AudioEngineState) => void> = new Set()

  static async enumerateInputDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter((d) => d.kind === 'audioinput')
  }

  get state(): AudioEngineState {
    return this._state
  }

  get audioContext(): AudioContext | null {
    return this._audioContext
  }

  get analyserNode(): AnalyserNode | null {
    return this._analyserNode
  }

  get gainNode(): GainNode | null {
    return this._gainNode
  }

  get currentDeviceId(): string | null {
    if (!this._mediaStream) return null
    const track = this._mediaStream.getAudioTracks()[0]
    if (!track) return null
    return track.getSettings().deviceId ?? null
  }

  get currentGain(): number {
    return this._gainNode?.gain.value ?? 1.0
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

  async initialize(deviceId?: string): Promise<void> {
    if (this._state === 'ready') return

    this.setState('requesting-permission')

    try {
      this._mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })

      this._audioContext = new AudioContext()
      this._sourceNode = this._audioContext.createMediaStreamSource(this._mediaStream)

      this._gainNode = this._audioContext.createGain()
      this._gainNode.gain.value = 1.0

      this._analyserNode = this._audioContext.createAnalyser()
      this._analyserNode.fftSize = 8192
      this._analyserNode.smoothingTimeConstant = 0

      this._sourceNode.connect(this._gainNode)
      this._gainNode.connect(this._analyserNode)

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

  async switchDevice(deviceId: string): Promise<void> {
    if (!this._audioContext || !this._gainNode || !this._analyserNode) {
      throw new Error('AudioEngine not initialized. Call initialize() first.')
    }

    // Stop existing media stream tracks
    if (this._mediaStream) {
      this._mediaStream.getTracks().forEach((track) => track.stop())
    }

    // Disconnect old source node
    if (this._sourceNode) {
      this._sourceNode.disconnect()
      this._sourceNode = null
    }

    // Get new stream with the selected device
    this._mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: deviceId },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })

    // Reconnect audio graph: source → gainNode → analyserNode
    this._sourceNode = this._audioContext.createMediaStreamSource(this._mediaStream)
    this._sourceNode.connect(this._gainNode)
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
    if (this._sourceNode) {
      this._sourceNode.disconnect()
      this._sourceNode = null
    }
    if (this._mediaStream) {
      this._mediaStream.getTracks().forEach((track) => track.stop())
      this._mediaStream = null
    }
    if (this._audioContext) {
      this._audioContext.close()
      this._audioContext = null
    }
    this._analyserNode = null
    this._gainNode = null
    this.setState('uninitialized')
  }
}
