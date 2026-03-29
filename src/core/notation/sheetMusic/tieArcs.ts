import type { SheetMeasure } from './types.ts'
import type { StaffLineLayout } from './lineLayout.ts'
import type { StaffConfig } from '../types.ts'
import { NOTE_DURATION_BEATS } from '@core/rhythm/types.ts'
import { noteToStaffY } from '../pitch.ts'
import { stemUp } from '../stem.ts'
import { staveContentStartX } from '../components/staveLayout.ts'

export interface TieArc {
  d: string
}

/** Compute total beats in a measure from its notes. */
function measureBeats(measure: SheetMeasure): number {
  return measure.notes.reduce((sum, n) => sum + NOTE_DURATION_BEATS[n.duration], 0)
}

function findLastNoteIndex(m: SheetMeasure): number {
  for (let i = m.notes.length - 1; i >= 0; i--) {
    if (!m.restIndices?.has(i)) return i
  }
  return -1
}

function findFirstNoteIndex(m: SheetMeasure): number {
  for (let i = 0; i < m.notes.length; i++) {
    if (!m.restIndices?.has(i)) return i
  }
  return -1
}

/** Compute per-measure tie flags: does this measure tie to the next? */
export function computeTies(measures: SheetMeasure[]): Array<{ tieFromPrev: boolean; tieToNext: boolean }> {
  return measures.map((measure, i) => {
    const prev = i > 0 ? measures[i - 1] : undefined
    const next = i < measures.length - 1 ? measures[i + 1] : undefined

    const lastIdx = findLastNoteIndex(measure)
    const firstIdx = findFirstNoteIndex(measure)

    let tieFromPrev = false
    if (prev && firstIdx >= 0) {
      const prevLastIdx = findLastNoteIndex(prev)
      if (prevLastIdx >= 0) {
        tieFromPrev = prev.notes[prevLastIdx].note.midi === measure.notes[firstIdx].note.midi
      }
    }

    let tieToNext = false
    if (next && lastIdx >= 0) {
      const nextFirstIdx = findFirstNoteIndex(next)
      if (nextFirstIdx >= 0) {
        tieToNext = measure.notes[lastIdx].note.midi === next.notes[nextFirstIdx].note.midi
      }
    }

    return { tieFromPrev, tieToNext }
  })
}

/** Compute SVG path data for tie arcs within a single line. */
export function computeTieArcsForLine(
  line: StaffLineLayout,
  measureXOffsets: number[],
  cellWidths: number[],
  ties: Array<{ tieFromPrev: boolean; tieToNext: boolean }>,
  config: StaffConfig,
  keySigExtraWidth: number,
): TieArc[] {
  const arcs: TieArc[] = []

  for (let mi = 0; mi < line.measures.length - 1; mi++) {
    const gmi = line.startMeasureIndex + mi
    if (!ties[gmi]?.tieToNext) continue

    const currMeasure = line.measures[mi]
    const nextMeasure = line.measures[mi + 1]

    const lastIdx = findLastNoteIndex(currMeasure)
    const firstIdx = findFirstNoteIndex(nextMeasure)
    if (lastIdx < 0 || firstIdx < 0) continue

    // X position of last note in current measure
    const currCellW = cellWidths[mi]
    const currIsFirst = gmi === 0
    const currIsLineStart = mi === 0
    const currKeySig = currIsFirst ? keySigExtraWidth : 0
    const currStartX = staveContentStartX(config, {
      showClef: currIsLineStart,
      showTimeSignature: currIsFirst,
      keySigAccidentalCount: currIsFirst ? Math.round(currKeySig / 10) : 0,
    })
    const currBeats = measureBeats(currMeasure)
    const currAvail = currCellW - currStartX
    let beatPos = 0
    for (let i = 0; i < lastIdx; i++) {
      beatPos += NOTE_DURATION_BEATS[currMeasure.notes[i].duration]
    }
    const lastDurBeats = NOTE_DURATION_BEATS[currMeasure.notes[lastIdx].duration]
    const lastPosDur = Math.min(lastDurBeats, 1)
    const x1 = measureXOffsets[mi] + currStartX + ((beatPos + lastPosDur / 2) / currBeats) * currAvail

    // X position of first note in next measure
    const nextCellW = cellWidths[mi + 1]
    const nextGmi = gmi + 1
    const nextIsFirst = nextGmi === 0
    const nextIsLineStart = mi + 1 === 0
    const nextKeySig = nextIsFirst ? keySigExtraWidth : 0
    const nextStartX = staveContentStartX(config, {
      showClef: nextIsLineStart,
      showTimeSignature: nextIsFirst,
      keySigAccidentalCount: nextIsFirst ? Math.round(nextKeySig / 10) : 0,
    })
    const nextBeats = measureBeats(nextMeasure)
    const nextAvail = nextCellW - nextStartX
    let nextBeatPos = 0
    for (let i = 0; i < firstIdx; i++) {
      nextBeatPos += NOTE_DURATION_BEATS[nextMeasure.notes[i].duration]
    }
    const firstDurBeats = NOTE_DURATION_BEATS[nextMeasure.notes[firstIdx].duration]
    const firstPosDur = Math.min(firstDurBeats, 1)
    const x2 = measureXOffsets[mi + 1] + nextStartX + ((nextBeatPos + firstPosDur / 2) / nextBeats) * nextAvail

    // Y position — both notes are the same pitch
    const noteY = noteToStaffY(currMeasure.notes[lastIdx].note, config)

    // Curve direction: away from staff center
    const curveDown = stemUp(noteY, config)
    const nr = config.noteRadius
    const yOff = curveDown ? nr + 2 : -(nr + 2)
    const span = Math.abs(x2 - x1)
    const curveH = Math.min(Math.max(span * 0.12, 5), 16)
    const cpYOff = curveDown ? curveH : -curveH

    const startY = noteY + yOff
    const cpY = startY + cpYOff
    const midX = (x1 + x2) / 2

    arcs.push({ d: `M ${x1} ${startY} Q ${midX} ${cpY} ${x2} ${startY}` })
  }

  return arcs
}
