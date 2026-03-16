export interface MetronomeConfig {
  bpm: number
  beatsPerMeasure: number
  volume: number
}

export type MetronomeState = {
  isPlaying: boolean
  currentBeat: number
  bpm: number
  beatsPerMeasure: number
}

export class MetronomeEngine {
  private audioContext: AudioContext
  private _bpm: number = 120
  private _beatsPerMeasure: number = 4
  private _volume: number = 0.5
  private _isPlaying: boolean = false
  private _currentBeat: number = 0
  private nextNoteTime: number = 0
  private schedulerInterval: ReturnType<typeof setInterval> | null = null
  private beatListeners: Set<(beat: number, time: number) => void> = new Set()

  // Look-ahead scheduling constants
  private readonly SCHEDULE_AHEAD_TIME = 0.1 // seconds
  private readonly SCHEDULER_INTERVAL = 25 // ms

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext
  }

  get state(): MetronomeState {
    return {
      isPlaying: this._isPlaying,
      currentBeat: this._currentBeat,
      bpm: this._bpm,
      beatsPerMeasure: this._beatsPerMeasure,
    }
  }

  onBeat(callback: (beat: number, time: number) => void): () => void {
    this.beatListeners.add(callback)
    return () => this.beatListeners.delete(callback)
  }

  start(): void {
    if (this._isPlaying) return

    this._isPlaying = true
    this._currentBeat = 0
    this.nextNoteTime = this.audioContext.currentTime

    this.schedulerInterval = setInterval(() => {
      this.schedule()
    }, this.SCHEDULER_INTERVAL)
  }

  stop(): void {
    if (!this._isPlaying) return

    this._isPlaying = false
    this._currentBeat = 0

    if (this.schedulerInterval !== null) {
      clearInterval(this.schedulerInterval)
      this.schedulerInterval = null
    }
  }

  setBpm(bpm: number): void {
    this._bpm = Math.max(30, Math.min(240, bpm))
  }

  setBeatsPerMeasure(beats: number): void {
    this._beatsPerMeasure = Math.max(1, Math.min(12, beats))
  }

  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume))
  }

  dispose(): void {
    this.stop()
    this.beatListeners.clear()
  }

  private schedule(): void {
    while (
      this.nextNoteTime <
      this.audioContext.currentTime + this.SCHEDULE_AHEAD_TIME
    ) {
      this.scheduleClick(this.nextNoteTime, this._currentBeat)
      this.notifyBeat(this._currentBeat, this.nextNoteTime)

      this._currentBeat = (this._currentBeat + 1) % this._beatsPerMeasure
      this.nextNoteTime += 60.0 / this._bpm
    }
  }

  private scheduleClick(time: number, beat: number): void {
    const osc = this.audioContext.createOscillator()
    const gain = this.audioContext.createGain()

    // Accent on beat 1
    const frequency = beat === 0 ? 880 : 440
    const clickVolume = beat === 0 ? this._volume : this._volume * 0.7

    osc.frequency.value = frequency
    gain.gain.value = clickVolume

    // Short click: 50ms
    gain.gain.setValueAtTime(clickVolume, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05)

    osc.connect(gain)
    gain.connect(this.audioContext.destination)

    osc.start(time)
    osc.stop(time + 0.05)
  }

  private notifyBeat(beat: number, time: number): void {
    this.beatListeners.forEach((cb) => cb(beat, time))
  }
}
