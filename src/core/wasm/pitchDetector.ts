import { getWasm } from './init.ts'
import type { DetectedPitch } from './types.ts'

export class TypedPitchDetector {
  private inner: InstanceType<ReturnType<typeof getWasm>['PitchDetector']>

  constructor(sampleRate: number, bufferSize: number) {
    const wasm = getWasm()
    this.inner = new wasm.PitchDetector(sampleRate, bufferSize)
  }

  detect(audioData: Float32Array): DetectedPitch | null {
    const result = this.inner.detect(audioData)
    return result as DetectedPitch | null
  }

  setPowerThreshold(threshold: number): void {
    this.inner.setPowerThreshold(threshold)
  }

  setClarityThreshold(threshold: number): void {
    this.inner.setClarityThreshold(threshold)
  }

  free(): void {
    this.inner.free()
  }
}
