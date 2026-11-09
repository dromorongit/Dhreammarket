/**
 * Confidence scoring.
 *
 *   score = 0 if roleFit is 0
 *        = 0.4*intent + 0.5*retrieval + 0.1*roleFit   otherwise
 *
 * where retrieval = min(1, 0.6*coverage + 0.4*min(1, topChunkScore)).
 *
 * HARD GATE: retrieval can never lift an unknown (or very weak) intent into
 * the answer band. Such a score is capped BELOW the clarify band, so the
 * decision layer applies the unknown-intent rules (escalate a sensitive
 * signal, otherwise ask one clarifying question) instead of a threshold.
 *
 * Hard gates (high risk, security block, no chunks for a policy-dependent
 * intent, role mismatch) always override this score in decide().
 */

import type { ConfidenceBreakdown } from '../types'

// STARTING VALUES — to be tuned on a labelled eval set before going live.
export const CONF = {
  answerAt: 0.75,
  escalateBelow: 0.5,
}

/** Below this intent confidence the intent is not trusted to answer. */
export const MIN_TRUSTED_INTENT_CONFIDENCE = 0.5

export interface ConfidenceInput {
  intentConfidence: number
  coverage: number
  topChunkScore: number
  // 1 when the actor may receive this intent, else 0.
  roleFit: number
}

export function computeConfidence(input: ConfidenceInput): ConfidenceBreakdown {
  const { intentConfidence, coverage, topChunkScore, roleFit } = input
  const retrieval = Math.min(1, 0.6 * coverage + 0.4 * Math.min(1, topChunkScore))
  let score =
    roleFit === 0
      ? 0
      : 0.4 * intentConfidence + 0.5 * retrieval + 0.1 * roleFit

  // An unknown or very weak intent stays below the clarify band no matter how
  // good the retrieved content is. Retrieval must never answer a request we
  // do not understand.
  if (intentConfidence < MIN_TRUSTED_INTENT_CONFIDENCE) {
    score = Math.min(score, CONF.escalateBelow - 0.01)
  }

  return { intent: intentConfidence, retrieval, roleFit, score }
}
