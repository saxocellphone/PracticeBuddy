export interface AGCConfig {
  /** Target RMS level for the post-gain signal (default: 0.125) */
  targetRms: number
  /** Maximum gain multiplier (default: 20) */
  maxGain: number
  /** Minimum gain — never attenuate below this (default: 1.0) */
  minGain: number
  /** EMA smoothing factor — higher = faster response (default: 0.1) */
  smoothingFactor: number
  /** RMS below this is treated as silence — gain holds steady (default: 0.001) */
  silenceThreshold: number
}

const DEFAULT_CONFIG: AGCConfig = {
  targetRms: 0.125,
  maxGain: 20,
  minGain: 1.0,
  smoothingFactor: 0.1,
  silenceThreshold: 0.001,
}

export function computeRms(buffer: Float32Array): number {
  let sum = 0
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i]
  }
  return Math.sqrt(sum / buffer.length)
}

export class AutoGainControl {
  private _gain: number = 1.0
  private readonly config: AGCConfig

  constructor(config?: Partial<AGCConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  get currentGain(): number {
    return this._gain
  }

  /**
   * Update AGC with a post-gain audio buffer.
   * Returns the new gain value to apply to the GainNode.
   *
   * Since the buffer is post-gain (already amplified by currentGain),
   * the formula accounts for that: desiredGain = currentGain × (target / measured).
   */
  update(buffer: Float32Array): number {
    const rms = computeRms(buffer)

    if (rms < this.config.silenceThreshold) {
      return this._gain
    }

    const desiredGain = this._gain * (this.config.targetRms / rms)
    const clamped = Math.min(Math.max(desiredGain, this.config.minGain), this.config.maxGain)

    // Exponential moving average for smooth transitions
    this._gain += this.config.smoothingFactor * (clamped - this._gain)
    this._gain = Math.min(Math.max(this._gain, this.config.minGain), this.config.maxGain)

    return this._gain
  }

  reset(): void {
    this._gain = 1.0
  }
}
