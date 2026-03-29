import { getDb } from '@core/db/index.ts'
import type {
  JazzStandard,
  JazzStandardMeasure,
  JazzStandardSummary,
} from './types.ts'
import type { ClefType } from '@core/instruments.ts'

export async function fetchAllStandards(): Promise<JazzStandardSummary[]> {
  const db = await getDb()
  const result = await db.query<{
    id: string
    title: string
    composer: string
    key: string
    form: string
    tags: string[] | null
  }>('SELECT id, title, composer, key, form, tags FROM jazz_standards')

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    composer: row.composer,
    key: row.key,
    form: row.form,
    tags: row.tags ?? undefined,
  }))
}

export async function fetchStandardById(
  id: string,
): Promise<JazzStandard | null> {
  const db = await getDb()
  const result = await db.query<{
    id: string
    title: string
    composer: string
    key: string
    time_sig_beats: number
    time_sig_value: number
    tempo: number | null
    form: string
    melody_clef: string
    tags: string[] | null
    measures: JazzStandardMeasure[]
  }>('SELECT * FROM jazz_standards WHERE id = $1', [id])

  if (result.rows.length === 0) return null

  const row = result.rows[0]
  return {
    id: row.id,
    title: row.title,
    composer: row.composer,
    key: row.key,
    timeSignature: { beats: row.time_sig_beats, value: row.time_sig_value },
    tempo: row.tempo ?? undefined,
    form: row.form,
    measures: row.measures,
    melodyClef: row.melody_clef as ClefType,
    tags: row.tags ?? undefined,
  }
}
