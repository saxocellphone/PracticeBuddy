/**
 * Derive pitch detection thresholds from a 0-100 mic sensitivity value.
 * Higher sensitivity → lower thresholds → picks up quieter/less clear sounds.
 */
export function sensitivityToThresholds(sensitivity: number): { clarityThreshold: number; powerThreshold: number } {
  // Clarity: 0.65 (strict) at sensitivity=0 → 0.15 (loose) at sensitivity=100
  const clarityThreshold = 0.65 - (sensitivity / 100) * 0.50
  // Power: 4.5 (strict) at sensitivity=0 → 0.5 (loose) at sensitivity=100
  const powerThreshold = 4.5 - (sensitivity / 100) * 4.0
  return { clarityThreshold, powerThreshold }
}
