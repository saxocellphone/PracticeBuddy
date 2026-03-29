import { useState, useEffect } from 'react'
import { fetchAllStandards, fetchStandardById } from '@core/jazz-standards/repository.ts'
import type { JazzStandard, JazzStandardSummary } from '@core/jazz-standards/types.ts'

interface StandardsState {
  standards: JazzStandardSummary[]
  loading: boolean
}

export function useJazzStandards(): {
  standards: JazzStandardSummary[]
  loading: boolean
} {
  const [state, setState] = useState<StandardsState>({
    standards: [],
    loading: true,
  })

  useEffect(() => {
    let cancelled = false
    fetchAllStandards().then((result) => {
      if (!cancelled) {
        setState({ standards: result, loading: false })
      }
    })
    return () => { cancelled = true }
  }, [])

  return state
}

interface StandardState {
  standard: JazzStandard | null
  loading: boolean
  loadedId: string | null
}

export function useJazzStandard(id: string | null): {
  standard: JazzStandard | null
  loading: boolean
} {
  const [state, setState] = useState<StandardState>({
    standard: null,
    loading: false,
    loadedId: null,
  })

  useEffect(() => {
    if (!id) return

    let cancelled = false
    fetchStandardById(id).then((result) => {
      if (!cancelled) {
        setState({ standard: result, loading: false, loadedId: id })
      }
    })
    return () => { cancelled = true }
  }, [id])

  // When id is null or changed, derive appropriate state
  if (!id) {
    return { standard: null, loading: false }
  }
  if (state.loadedId !== id) {
    return { standard: null, loading: true }
  }
  return { standard: state.standard, loading: state.loading }
}
