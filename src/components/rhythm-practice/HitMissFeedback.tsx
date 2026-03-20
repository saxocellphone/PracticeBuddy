import { useEffect, useState, memo } from 'react'
import type { TimingResult } from '@core/rhythm/types.ts'
import styles from './HitMissFeedback.module.css'

/** Duration in ms before the feedback component unmounts itself */
const FEEDBACK_LIFETIME_MS = 600

interface HitMissFeedbackProps {
  /** The timing result that triggered this feedback */
  timingResult: TimingResult
  /** Whether the pitch was correct (affects hit vs miss classification) */
  pitchCorrect: boolean
}

/**
 * OSU-style hit/miss feedback overlay.
 * Renders expanding rings + particles for hits, or shake + X for misses.
 * Auto-removes itself after the animation completes.
 *
 * This component should be rendered with a unique `key` prop so React
 * re-mounts it for each new feedback event, resetting the animation.
 */
export const HitMissFeedback = memo(function HitMissFeedback({
  timingResult,
  pitchCorrect,
}: HitMissFeedbackProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), FEEDBACK_LIFETIME_MS)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  // A "hit" is when pitch is correct AND timing is perfect or good
  const isHit = pitchCorrect && (timingResult === 'perfect' || timingResult === 'good')
  const isLate = timingResult === 'late'
  const isMissed = timingResult === 'missed' || (!pitchCorrect && !isLate)

  if (isHit) {
    const tier = timingResult as 'perfect' | 'good'
    return <HitEffect tier={tier} />
  }

  if (isLate) {
    return <MissEffect severity="late" />
  }

  if (isMissed) {
    return <MissEffect severity="missed" />
  }

  return null
})

/** Particle positions -- pre-computed angles for 6 particles */
const PARTICLE_ANGLES = [0, 60, 120, 180, 240, 300]
const PARTICLE_DISTANCE = 30

function HitEffect({ tier }: { tier: 'perfect' | 'good' }) {
  const ringClass = tier === 'perfect' ? styles.hitRing_perfect : styles.hitRing_good
  const flashClass = tier === 'perfect' ? styles.hitFlash_perfect : styles.hitFlash_good
  const particleClass = tier === 'perfect' ? styles.hitParticle_perfect : styles.hitParticle_good
  const labelClass = tier === 'perfect' ? styles.hitLabel_perfect : styles.hitLabel_good

  return (
    <div className={styles.feedbackContainer}>
      {/* Flash burst */}
      <div className={`${styles.hitFlash} ${flashClass}`} />

      {/* Expanding rings */}
      <div className={`${styles.hitRing} ${ringClass}`} />
      <div className={`${styles.hitRing} ${styles.hitRingOuter} ${ringClass}`} />

      {/* Particle sparks */}
      {PARTICLE_ANGLES.map((angle, i) => {
        const rad = (angle * Math.PI) / 180
        const tx = Math.cos(rad) * PARTICLE_DISTANCE
        const ty = Math.sin(rad) * PARTICLE_DISTANCE
        return (
          <div
            key={i}
            className={`${styles.hitParticle} ${particleClass}`}
            style={{
              animation: `hitParticleMove${i} 450ms ease-out forwards`,
            }}
          >
            <style>{`
              @keyframes hitParticleMove${i} {
                0% { transform: translate(0, 0) scale(1); opacity: 1; }
                100% { transform: translate(${tx}px, ${ty}px) scale(0.3); opacity: 0; }
              }
            `}</style>
          </div>
        )
      })}

      {/* Score label */}
      <div className={`${styles.hitLabel} ${labelClass}`}>
        {tier === 'perfect' ? 'Perfect!' : 'Good'}
      </div>
    </div>
  )
}

function MissEffect({ severity }: { severity: 'missed' | 'late' }) {
  const flashClass = severity === 'missed' ? styles.missFlash_missed : styles.missFlash_late
  const xClass = severity === 'missed' ? styles.missX_missed : styles.missX_late
  const labelClass = severity === 'missed' ? styles.lateLabel_missed : styles.lateLabel_late

  return (
    <div className={styles.feedbackContainer}>
      {/* Red/amber flash overlay */}
      <div className={`${styles.missFlash} ${flashClass}`} />

      {/* Shake wrapper with X mark */}
      <div className={styles.missShake}>
        {severity === 'missed' ? (
          <span className={`${styles.missX} ${xClass}`}>X</span>
        ) : (
          <span className={`${styles.lateLabel} ${labelClass}`}>Late</span>
        )}
      </div>
    </div>
  )
}
