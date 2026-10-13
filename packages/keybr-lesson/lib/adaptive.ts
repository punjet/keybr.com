import { type KeySample } from "@keybr/result";
import { type LessonKey } from "./key.ts";

/**
 * Tunables of the adaptive guided mode.
 *
 * The original algorithm looks only at speed and at the best speed ever
 * reached, so a key that regressed or is typed with many errors is never
 * trained again, and a single slow key can block new letters for hours.
 */
export const adaptive = {
  /** Smoothing factor of the per-key error rate. */
  errorAlpha: 0.1,
  /** Error rate considered acceptable, no penalty below it. */
  errorTarget: 0.03,
  /** How much each percent of extra errors reduces the confidence. */
  errorPenalty: 2,
  /** The lowest accuracy factor, so errors alone never zero the confidence. */
  minAccuracyFactor: 0.4,
  /** Keys below this confidence get extra weight in generated words. */
  weakConfidence: 1,
  /** New keys with fewer lessons than this are treated as weak. */
  minSamples: 5,
  /** Average confidence needed to break a stall. */
  stallConfidence: 0.9,
  /** Auto target speed is the median best key speed times this. */
  targetMargin: 1.05,
} as const;

/** Exponentially smoothed share of mistyped keystrokes. */
export function errorRateOf(samples: readonly KeySample[]): number | null {
  let rate: number | null = null;
  for (const { hitCount, missCount } of samples) {
    const total = hitCount + missCount;
    if (total > 0) {
      const value = missCount / total;
      rate = rate == null ? value : rate + adaptive.errorAlpha * (value - rate);
    }
  }
  return rate;
}

/** A multiplier in [minAccuracyFactor, 1] derived from the error rate. */
export function accuracyFactor(errorRate: number | null): number {
  if (errorRate == null) {
    return 1;
  }
  const extra = Math.max(0, errorRate - adaptive.errorTarget);
  return Math.max(
    adaptive.minAccuracyFactor,
    1 - adaptive.errorPenalty * extra,
  );
}

/** Speed confidence corrected for accuracy, null for keys without data. */
export function effectiveConfidence(key: LessonKey): number | null {
  if (key.confidence == null) {
    return null;
  }
  return key.confidence * accuracyFactor(errorRateOf(key.samples));
}

/**
 * How much a key needs practice: zero for mastered keys, growing with the gap
 * to the target and with the letter frequency, since frequent letters
 * dominate real text speed.
 */
export function needOf(key: LessonKey, maxFrequency: number): number {
  const confidence = effectiveConfidence(key);
  const gap =
    confidence == null || key.samples.length < adaptive.minSamples
      ? 1
      : Math.max(0, adaptive.weakConfidence - confidence);
  const frequency = maxFrequency > 0 ? key.letter.f / maxFrequency : 0;
  return gap * (0.5 + frequency);
}

/** Frequency weighted mean of effective confidences, capped per key. */
export function meanConfidence(keys: readonly LessonKey[]): number {
  let sum = 0;
  let weight = 0;
  for (const key of keys) {
    const confidence = effectiveConfidence(key) ?? 0;
    sum += Math.min(confidence, 1.2) * key.letter.f;
    weight += key.letter.f;
  }
  return weight > 0 ? sum / weight : 0;
}
