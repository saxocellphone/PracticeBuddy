import { useState, useEffect } from 'react'
import { initWasm } from '@core/wasm/init.ts'

export type WasmStatus = 'loading' | 'ready' | 'error'

export interface WasmState {
  status: WasmStatus
  error?: Error
}

export function useWasm(): WasmState {
  const [state, setState] = useState<WasmState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    initWasm()
      .then(() => {
        if (!cancelled) setState({ status: 'ready' })
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ status: 'error', error })
      })

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
