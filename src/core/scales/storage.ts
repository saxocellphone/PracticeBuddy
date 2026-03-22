import type { SavedCustomSequence } from './types.ts'

const STORAGE_KEY = 'practicebuddy:custom-sequences'

export function loadCustomSequences(): SavedCustomSequence[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Validate each entry has required fields
    return parsed.filter(
      (s: unknown): s is SavedCustomSequence =>
        typeof s === 'object' &&
        s !== null &&
        typeof (s as SavedCustomSequence).id === 'string' &&
        typeof (s as SavedCustomSequence).name === 'string' &&
        Array.isArray((s as SavedCustomSequence).steps) &&
        (s as SavedCustomSequence).steps.length > 0
    )
  } catch {
    return []
  }
}

export function saveCustomSequence(seq: SavedCustomSequence): void {
  const existing = loadCustomSequences()
  const index = existing.findIndex((s) => s.id === seq.id)
  if (index >= 0) {
    existing[index] = seq
  } else {
    existing.push(seq)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))
}

export function deleteCustomSequence(id: string): void {
  const existing = loadCustomSequences()
  const filtered = existing.filter((s) => s.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
}
