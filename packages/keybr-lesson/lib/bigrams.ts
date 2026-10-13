import { type Keyboard, type KeyShape } from "@keybr/keyboard";
import { type CodePoint } from "@keybr/unicode";

/** Smoothed timing and accuracy of typing `b` right after `a`. */
export type BigramEntry = {
  /** Number of observations. */
  readonly n: number;
  /** Smoothed time to type the second letter, ms. */
  readonly t: number;
  /** Smoothed error rate of the second letter. */
  readonly e: number;
};

export type BigramStep = {
  readonly codePoint: CodePoint;
  readonly timeToType: number;
  readonly typo: boolean;
};

const alpha = 0.2;
/** Longer gaps are pauses, not typing. */
const maxTime = 2500;
/** Bound the storage size, keep the most observed pairs. */
const maxEntries = 3000;

/**
 * Per-transition statistics accumulated from keystrokes across lessons.
 *
 * Per-key statistics hide the real problem of a new keyboard: a key can be
 * fast on its own but slow after a particular other key (the same finger,
 * a jump between the top and the bottom rows, etc.).
 */
export class BigramStats {
  readonly #map = new Map<string, BigramEntry>();

  static fromJSON(json: unknown): BigramStats {
    const stats = new BigramStats();
    if (json != null && typeof json === "object") {
      for (const [key, value] of Object.entries(json)) {
        if (
          [...key].length === 2 &&
          Array.isArray(value) &&
          value.length === 3 &&
          value.every(Number.isFinite)
        ) {
          const [n, t, e] = value as number[];
          stats.#map.set(key, { n, t, e });
        }
      }
    }
    return stats;
  }

  get size(): number {
    return this.#map.size;
  }

  get(a: CodePoint, b: CodePoint): BigramEntry | null {
    return this.#map.get(String.fromCodePoint(a, b)) ?? null;
  }

  entries(): IterableIterator<[string, BigramEntry]> {
    return this.#map.entries();
  }

  /** Adds the keystrokes of a finished lesson, only letter-to-letter pairs. */
  addSteps(steps: readonly BigramStep[], isLetter: (c: CodePoint) => boolean) {
    for (let i = 1; i < steps.length; i++) {
      const prev = steps[i - 1];
      const step = steps[i];
      if (
        prev.typo ||
        !isLetter(prev.codePoint) ||
        !isLetter(step.codePoint) ||
        !(step.timeToType > 0 && step.timeToType <= maxTime)
      ) {
        continue;
      }
      const key = String.fromCodePoint(prev.codePoint, step.codePoint);
      const old = this.#map.get(key);
      const e = step.typo ? 1 : 0;
      this.#map.set(
        key,
        old == null
          ? { n: 1, t: step.timeToType, e }
          : {
              n: old.n + 1,
              t: old.t + alpha * (step.timeToType - old.t),
              e: old.e + alpha * (e - old.e),
            },
      );
    }
    if (this.#map.size > maxEntries) {
      const sorted = [...this.#map].sort(([, a], [, b]) => b.n - a.n);
      this.#map.clear();
      for (const [key, value] of sorted.slice(0, maxEntries)) {
        this.#map.set(key, value);
      }
    }
  }

  toJSON(): Record<string, [number, number, number]> {
    const json: Record<string, [number, number, number]> = {};
    for (const [key, { n, t, e }] of this.#map) {
      json[key] = [n, Math.round(t), Math.round(e * 1000) / 1000];
    }
    return json;
  }
}

/**
 * The bigram statistics of the current user, filled by the practice page
 * from the browser storage and read by the lesson generators.
 */
export const bigramStore: { current: BigramStats } = {
  current: new BigramStats(),
};

/**
 * Prior difficulty of a transition from the keyboard geometry, used until
 * enough real observations are collected. Tuned for column staggered split
 * boards, where the worst transitions are same-finger pairs and jumps over
 * the home row with neighbouring fingers of the same hand.
 */
export function geometryDifficulty(
  keyboard: Keyboard,
  a: CodePoint,
  b: CodePoint,
): number {
  const sa = shapeOf(keyboard, a);
  const sb = shapeOf(keyboard, b);
  if (sa == null || sb == null || sa.hand !== sb.hand || sa === sb) {
    return 0;
  }
  const rows = Math.abs(rowIndex(sa) - rowIndex(sb));
  if (sa.finger === sb.finger) {
    return rows >= 2 ? 1 : 0.7; // Same finger bigram.
  }
  const fingers = Math.abs(fingerIndex(sa) - fingerIndex(sb));
  if (rows >= 2) {
    return fingers === 1 ? 0.5 : 0.3; // Full scissor or a row jump.
  }
  if (rows === 1 && fingers === 1) {
    return 0.15; // Half scissor.
  }
  return 0;
}

function shapeOf(keyboard: Keyboard, codePoint: CodePoint): KeyShape | null {
  const combo = keyboard.getCombo(codePoint);
  return combo != null ? keyboard.getShape(combo.id) : null;
}

function rowIndex({ row }: KeyShape): number {
  switch (row) {
    case "digit":
      return 0;
    case "top":
      return 1;
    case "home":
      return 2;
    default:
      return 3;
  }
}

function fingerIndex({ finger }: KeyShape): number {
  switch (finger) {
    case "pinky":
      return 0;
    case "ring":
      return 1;
    case "middle":
      return 2;
    default:
      return 3;
  }
}

/**
 * How much the transition needs practice, comparable with the per-key need.
 *
 * Blends the geometry prior (scaled by the weakness of both keys) with the
 * measured slowdown relative to the target speed and the error rate,
 * trusting measurements more as observations accumulate.
 */
export function bigramNeed(
  entry: BigramEntry | null,
  prior: number,
  keysNeed: number,
  targetTime: number,
): number {
  const priorNeed = prior * (0.3 + keysNeed);
  if (entry == null) {
    return priorNeed;
  }
  const slow = Math.max(0, entry.t / targetTime - 1);
  const errors = Math.max(0, entry.e - 0.03) * 4;
  const measured = slow + errors;
  const w = entry.n / (entry.n + 8);
  return (1 - w) * priorNeed + w * measured;
}
