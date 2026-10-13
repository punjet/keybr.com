import {
  BigramStats,
  bigramStore,
  ConfusionStats,
  confusionStore,
} from "@keybr/lesson";
import { type Confusion, type Step } from "@keybr/textinput";
import { type CodePoint } from "@keybr/unicode";

// Keys of the browser storage, also used by the profile export/import.
const bigramsKey = (family: string) => `bigrams.${family}`;
const confusionsKey = (family: string) => `confusions.${family}`;

const isLetter = (codePoint: CodePoint): boolean => {
  const char = String.fromCodePoint(codePoint);
  return char.toLowerCase() !== char.toUpperCase();
};

function read(key: string): unknown {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "null");
  } catch {
    return null; // Missing or corrupted data, start from scratch.
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is full or disabled, keep the statistics in memory.
  }
}

/**
 * Makes the keystroke statistics of the given layout family current.
 * Reads the storage every time, so imported data is picked up at once.
 */
export function loadBigrams(family: string): void {
  bigramStore.current = BigramStats.fromJSON(read(bigramsKey(family)));
  confusionStore.current = ConfusionStats.fromJSON(read(confusionsKey(family)));
}

/** Adds the keystrokes of a finished lesson and persists the statistics. */
export function saveBigrams(
  family: string,
  steps: readonly Step[],
  confusions: readonly Confusion[],
): void {
  loadBigrams(family);
  bigramStore.current.addSteps(steps, isLetter);
  confusionStore.current.add(confusions, isLetter);
  write(bigramsKey(family), bigramStore.current);
  write(confusionsKey(family), confusionStore.current);
}
