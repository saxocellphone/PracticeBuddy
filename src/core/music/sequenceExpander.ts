import { transpose } from '@core/endless/presets.ts'
import { pitchClassesMatch } from './pitchClass.ts'

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/**
 * Common shape shared by ScaleSequence and ArpeggioSequence.
 * Both satisfy this interface.
 */
interface ExpandableSequence<S> {
  steps: S[]
  shiftSemitones?: number
  loopCount?: number
  shiftUntilKey?: string
}

/**
 * Expand a sequence by materializing all loop iterations and transpositions
 * into a flat step array with shiftSemitones set to 0.
 *
 * Three modes:
 * 1. shiftSemitones === 0, loopCount > 1 → duplicate steps loopCount times
 * 2. shiftSemitones > 0, shiftUntilKey set → transpose until first step's root matches target key
 * 3. shiftSemitones > 0, no shiftUntilKey → full circle: 12 / gcd(12, shift) transpositions
 *
 * @param getStepRoot   Extract the root pitch class and octave from a step
 * @param transposeStep Create a new step with the given transposed pitch class and octave
 */
export function expandSequenceWithLoops<T extends ExpandableSequence<S>, S>(
  sequence: T,
  getStepRoot: (step: S) => { root: string; octave: number },
  transposeStep: (step: S, pitchClass: string, octave: number) => S,
): T {
  const shift = sequence.shiftSemitones ?? 0
  const loopCount = sequence.loopCount ?? 1

  // Case 1: No shift — duplicate steps loopCount times
  if (shift === 0) {
    if (loopCount <= 1) return sequence
    const expandedSteps: S[] = []
    for (let i = 0; i < loopCount; i++) {
      expandedSteps.push(...sequence.steps)
    }
    return { ...sequence, steps: expandedSteps, shiftSemitones: 0 }
  }

  // Max unique transpositions before the cycle repeats
  const maxTranspositions = 12 / gcd(12, Math.abs(shift))

  // Determine how many iterations to generate
  let numIterations: number

  if (sequence.shiftUntilKey) {
    // Case 2: shift until we reach the target key
    const startRoot = getStepRoot(sequence.steps[0]).root
    if (pitchClassesMatch(startRoot, sequence.shiftUntilKey)) {
      // Target is same as start — full circle
      numIterations = maxTranspositions
    } else {
      numIterations = maxTranspositions // fallback if target is unreachable
      for (let i = 1; i < maxTranspositions; i++) {
        const { pitchClass } = transpose(startRoot, 1, shift * i)
        if (pitchClassesMatch(pitchClass, sequence.shiftUntilKey)) {
          numIterations = i + 1 // include this transposition
          break
        }
      }
    }
  } else {
    // Case 3: full circle
    numIterations = maxTranspositions
  }

  // Build all transposed steps
  const expandedSteps: S[] = []
  for (let i = 0; i < numIterations; i++) {
    const totalShift = shift * i
    for (const step of sequence.steps) {
      const { root, octave } = getStepRoot(step)
      const { pitchClass, octave: newOctave } = transpose(root, octave, totalShift)
      expandedSteps.push(transposeStep(step, pitchClass, newOctave))
    }
  }

  return { ...sequence, steps: expandedSteps, shiftSemitones: 0 }
}
