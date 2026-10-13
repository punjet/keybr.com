import { test } from "node:test";
import { ResultFaker } from "@keybr/result";
import { deepEqual, equal } from "rich-assert";
import {
  clearAdaptiveData,
  formatDownloadedData,
  mergeAdaptiveData,
  newResultsOnly,
  parseDownloadedData,
  readAdaptiveData,
} from "./importdata.ts";

class MemoryStorage implements Storage {
  readonly #map = new Map<string, string>();
  get length() {
    return this.#map.size;
  }
  key(index: number) {
    return [...this.#map.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.#map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.#map.set(key, value);
  }
  removeItem(key: string) {
    this.#map.delete(key);
  }
  clear() {
    this.#map.clear();
  }
}

test("round trip results and keystroke statistics", () => {
  const results = new ResultFaker().nextResultList(5);
  const storage = new MemoryStorage();
  storage.setItem("bigrams.йцукен", JSON.stringify({ ст: [10, 300, 0.1] }));
  storage.setItem("confusions.йцукен", JSON.stringify({ сч: 3 }));
  storage.setItem("settings", "{}");

  const file = JSON.parse(formatDownloadedData(results, storage));
  const parsed = parseDownloadedData(file);
  equal(parsed.results.length, 5);
  equal(newResultsOnly(results, parsed.results).length, 0);
  deepEqual(Object.keys(parsed.adaptive).sort(), [
    "bigrams.йцукен",
    "confusions.йцукен",
  ]);

  const other = new MemoryStorage();
  other.setItem("confusions.йцукен", JSON.stringify({ сч: 9 }));
  // Local confusions hold more data and are kept, bigrams are restored.
  equal(mergeAdaptiveData(other, parsed.adaptive), 1);
  deepEqual(readAdaptiveData(other), {
    "bigrams.йцукен": { ст: [10, 300, 0.1] },
    "confusions.йцукен": { сч: 9 },
  });

  clearAdaptiveData(other);
  equal(other.length, 0);
});

test("read the original keybr format", () => {
  const results = new ResultFaker().nextResultList(3);
  const parsed = parseDownloadedData(JSON.parse(JSON.stringify(results)));
  equal(parsed.results.length, 3);
  deepEqual(parsed.adaptive, {});
});
