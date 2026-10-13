import { Layout } from "@keybr/keyboard";
import { isPlainObject, isString } from "@keybr/lang";
import { Result, TextType } from "@keybr/result";
import { Histogram } from "@keybr/textinput";

/** Keystroke statistics kept in the browser storage, by storage key. */
export type AdaptiveData = Record<string, unknown>;

const adaptivePrefixes = ["bigrams.", "confusions."];

const isAdaptiveKey = (key: string) =>
  adaptivePrefixes.some((prefix) => key.startsWith(prefix));

/**
 * Parses the file produced by the "Download data" button: either a plain
 * JSON array of `Result.toJSON()` objects (the original keybr format), or
 * an object with the results and the bigram and confusion statistics.
 */
export function parseDownloadedData(json: unknown): {
  results: Result[];
  adaptive: AdaptiveData;
} {
  let items: unknown;
  let adaptive: AdaptiveData = {};
  if (Array.isArray(json)) {
    items = json;
  } else if (isPlainObject(json)) {
    const data = json as { results?: unknown; adaptive?: unknown };
    items = data.results;
    if (isPlainObject(data.adaptive)) {
      adaptive = Object.fromEntries(
        Object.entries(data.adaptive as AdaptiveData).filter(([key]) =>
          isAdaptiveKey(key),
        ),
      );
    }
  }
  if (!Array.isArray(items)) {
    throw new TypeError("Expected a JSON array of results");
  }
  const results: Result[] = [];
  for (const item of items) {
    const result = resultFromDownloadedJson(item);
    if (result != null) {
      results.push(result);
    }
  }
  return { results, adaptive };
}

/** Builds the file for the "Download data" button. */
export function formatDownloadedData(
  results: readonly Result[],
  storage: Storage,
): string {
  return JSON.stringify({
    results,
    adaptive: readAdaptiveData(storage),
  });
}

export function readAdaptiveData(storage: Storage): AdaptiveData {
  const data: AdaptiveData = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key != null && isAdaptiveKey(key)) {
      try {
        data[key] = JSON.parse(storage.getItem(key) ?? "null");
      } catch {
        // Skip corrupted entries.
      }
    }
  }
  return data;
}

/**
 * Restores imported statistics, keeping the local version of an entry
 * when it holds more observations than the imported one.
 * Returns the number of restored entries.
 */
export function mergeAdaptiveData(
  storage: Storage,
  imported: AdaptiveData,
): number {
  let restored = 0;
  for (const [key, value] of Object.entries(imported)) {
    let local: unknown = null;
    try {
      local = JSON.parse(storage.getItem(key) ?? "null");
    } catch {
      // Corrupted local data is replaced.
    }
    if (weightOf(value) > weightOf(local)) {
      storage.setItem(key, JSON.stringify(value));
      restored++;
    }
  }
  return restored;
}

export function clearAdaptiveData(storage: Storage): void {
  for (const key of Object.keys(readAdaptiveData(storage))) {
    storage.removeItem(key);
  }
}

/** Total observations: bigram counts are `[n, t, e]`, confusions numbers. */
function weightOf(value: unknown): number {
  if (!isPlainObject(value)) {
    return 0;
  }
  let weight = 0;
  for (const entry of Object.values(value as Record<string, unknown>)) {
    if (Array.isArray(entry) && Number.isFinite(entry[0])) {
      weight += entry[0] as number;
    } else if (Number.isFinite(entry)) {
      weight += entry as number;
    }
  }
  return weight;
}

/** Returns only results not present among the existing ones. */
export function newResultsOnly(
  existing: readonly Result[],
  imported: readonly Result[],
): Result[] {
  const seen = new Set(existing.map(resultKey));
  return imported
    .filter((result) => !seen.has(resultKey(result)))
    .sort((a, b) => a.timeStamp - b.timeStamp);
}

function resultKey({ timeStamp, length, time }: Result): string {
  return `${timeStamp}:${length}:${time}`;
}

function resultFromDownloadedJson(json: unknown): Result | null {
  if (!isPlainObject(json)) {
    return null;
  }
  const { layout, textType, timeStamp, length, time, errors, histogram } =
    json as Record<string, unknown>;
  const ts = isString(timeStamp) ? Date.parse(timeStamp) : timeStamp;
  if (!(
    isString(layout) &&
    isString(textType) &&
    Number.isSafeInteger(ts) &&
    Number.isSafeInteger(length) &&
    Number.isSafeInteger(time) &&
    Number.isSafeInteger(errors) &&
    Array.isArray(histogram)
  )) {
    return null;
  }
  const samples = [];
  for (const sample of histogram) {
    if (!isPlainObject(sample)) {
      return null;
    }
    const { codePoint, hitCount, missCount, timeToType } = sample as Record<
      string,
      number
    >;
    if (!(
      Number.isSafeInteger(codePoint) &&
      Number.isSafeInteger(hitCount) &&
      Number.isSafeInteger(missCount) &&
      Number.isFinite(timeToType)
    )) {
      return null;
    }
    samples.push({
      codePoint,
      hitCount,
      missCount,
      timeToType: Math.round(timeToType),
    });
  }
  try {
    const result = new Result(
      Layout.ALL.get(layout),
      TextType.ALL.get(textType),
      ts as number,
      length as number,
      time as number,
      errors as number,
      new Histogram(samples),
    );
    return result.validate() ? result : null;
  } catch {
    return null;
  }
}
