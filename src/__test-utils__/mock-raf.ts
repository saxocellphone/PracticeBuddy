/**
 * Manual requestAnimationFrame control for deterministic testing.
 *
 * Replaces `window.requestAnimationFrame` and `window.cancelAnimationFrame`
 * with a queue-based implementation that only fires callbacks when you
 * explicitly call `step()` or `flush()`.
 */
export interface RAFController {
  /** Flush one pending RAF callback (the oldest) */
  step(): void
  /** Flush all pending RAF callbacks, up to `limit` (default 100) */
  flush(limit?: number): void
  /** Number of pending callbacks in the queue */
  readonly pending: number
  /** Restore the original requestAnimationFrame / cancelAnimationFrame */
  restore(): void
}

/**
 * Install a manual RAF controller on the global `window` object.
 *
 * @example
 * ```ts
 * let raf: RAFController
 * beforeEach(() => { raf = installMockRAF() })
 * afterEach(() => { raf.restore() })
 *
 * // In your test:
 * requestAnimationFrame(() => { ... })
 * raf.step() // fires the callback synchronously
 * ```
 */
export function installMockRAF(): RAFController {
  const originalRAF = window.requestAnimationFrame
  const originalCancelRAF = window.cancelAnimationFrame

  let nextId = 1
  const queue = new Map<number, FrameRequestCallback>()
  let timestamp = 0

  window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
    const id = nextId++
    queue.set(id, callback)
    return id
  }

  window.cancelAnimationFrame = (id: number): void => {
    queue.delete(id)
  }

  const controller: RAFController = {
    step() {
      // Fire the first (oldest) callback
      const entry = queue.entries().next()
      if (entry.done) return

      const [id, callback] = entry.value
      queue.delete(id)
      timestamp += 16 // ~60fps
      callback(timestamp)
    },

    flush(limit = 100) {
      let count = 0
      while (queue.size > 0 && count < limit) {
        controller.step()
        count++
      }
    },

    get pending() {
      return queue.size
    },

    restore() {
      window.requestAnimationFrame = originalRAF
      window.cancelAnimationFrame = originalCancelRAF
    },
  }

  return controller
}
