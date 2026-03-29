import { getWasm } from './init.ts'
import type { SessionConfig, SessionState, SessionScore } from './types.ts'

export class TypedPracticeSession {
  private inner: InstanceType<ReturnType<typeof getWasm>['PracticeSession']>

  constructor() {
    const wasm = getWasm()
    this.inner = new wasm.PracticeSession()
  }

  start(config: SessionConfig): SessionState {
    return this.inner.start(config) as SessionState
  }

  processFrame(
    detectedFrequency: number,
    detectedClarity: number,
    detectedRms: number,
  ): SessionState {
    return this.inner.processFrame(detectedFrequency, detectedClarity, detectedRms) as SessionState
  }

  skipNote(): SessionState {
    return this.inner.skipNote() as SessionState
  }

  getState(): SessionState {
    return this.inner.getState() as SessionState
  }

  getScore(): SessionScore {
    return this.inner.getScore() as SessionScore
  }

  reset(): void {
    this.inner.reset()
  }

  free(): void {
    this.inner.free()
  }
}
