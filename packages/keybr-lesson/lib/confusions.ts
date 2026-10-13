import { type CodePoint } from "@keybr/unicode";

export type ConfusionEntry = {
  readonly expected: CodePoint;
  readonly actual: CodePoint;
  /** Decayed number of times `actual` was typed instead of `expected`. */
  readonly count: number;
};

/** Older lessons weigh less, so fixed habits fade away. */
const decay = 0.97;
const minCount = 0.05;

/**
 * Which wrong key is typed instead of the expected one.
 *
 * After switching to a column staggered board most errors are not random:
 * fingers still move to where a key used to be on a row staggered board,
 * so the same pairs (like с→ч or и→т) repeat again and again.
 */
export class ConfusionStats {
  readonly #map = new Map<string, number>();

  static fromJSON(json: unknown): ConfusionStats {
    const stats = new ConfusionStats();
    if (json != null && typeof json === "object") {
      for (const [key, value] of Object.entries(json)) {
        if ([...key].length === 2 && Number.isFinite(value)) {
          stats.#map.set(key, value as number);
        }
      }
    }
    return stats;
  }

  get size(): number {
    return this.#map.size;
  }

  count(expected: CodePoint, actual: CodePoint): number {
    return this.#map.get(String.fromCodePoint(expected, actual)) ?? 0;
  }

  /** Adds the typos of a finished lesson, ages the older ones. */
  add(
    confusions: readonly {
      readonly expected: CodePoint;
      readonly actual: CodePoint;
    }[],
    isLetter: (codePoint: CodePoint) => boolean,
  ): void {
    for (const [key, value] of this.#map) {
      const aged = value * decay;
      if (aged < minCount) {
        this.#map.delete(key);
      } else {
        this.#map.set(key, aged);
      }
    }
    for (const { expected, actual } of confusions) {
      if (expected !== actual && isLetter(expected) && isLetter(actual)) {
        const key = String.fromCodePoint(expected, actual);
        this.#map.set(key, (this.#map.get(key) ?? 0) + 1);
      }
    }
  }

  /** The most frequent confusions, the worst first. */
  top(limit: number): ConfusionEntry[] {
    return [...this.#map]
      .map(([key, count]) => {
        const [expected, actual] = [...key].map((c) => c.codePointAt(0)!);
        return { expected, actual, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  toJSON(): Record<string, number> {
    const json: Record<string, number> = {};
    for (const [key, value] of this.#map) {
      json[key] = Math.round(value * 100) / 100;
    }
    return json;
  }
}

/** The confusion statistics of the current user, see `bigramStore`. */
export const confusionStore: { current: ConfusionStats } = {
  current: new ConfusionStats(),
};
