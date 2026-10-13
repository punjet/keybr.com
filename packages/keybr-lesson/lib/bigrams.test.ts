import { test } from "node:test";
import { Geometry, Language, Layout, loadKeyboard } from "@keybr/keyboard";
import { loadModelSync } from "@keybr/phonetic-model/lib/fs-load.ts";
import { makeKeyStatsMap } from "@keybr/result";
import { Settings } from "@keybr/settings";
import { equal, isTrue } from "rich-assert";
import {
  bigramNeed,
  BigramStats,
  bigramStore,
  geometryDifficulty,
} from "./bigrams.ts";
import { GuidedLesson } from "./guided.ts";

const cp = (s: string) => s.codePointAt(0)!;
const isLetter = (c: number) =>
  String.fromCodePoint(c).toLowerCase() !==
  String.fromCodePoint(c).toUpperCase();

test("collect transitions from keystrokes", () => {
  const stats = new BigramStats();
  stats.addSteps(
    [
      { codePoint: cp("с"), timeToType: 300, typo: false },
      { codePoint: cp("т"), timeToType: 400, typo: false },
      { codePoint: cp(" "), timeToType: 200, typo: false },
      { codePoint: cp("с"), timeToType: 300, typo: false },
      { codePoint: cp("т"), timeToType: 200, typo: true },
      { codePoint: cp("о"), timeToType: 9000, typo: false },
    ],
    isLetter,
  );
  // Spaces are skipped, pauses are ignored, the pair after a typo too.
  equal(stats.size, 1);
  const entry = stats.get(cp("с"), cp("т"))!;
  equal(entry.n, 2);
  equal(entry.t, 400 + 0.2 * (200 - 400));
  equal(entry.e, 0.2);
  const copy = BigramStats.fromJSON(JSON.parse(JSON.stringify(stats)));
  equal(copy.get(cp("с"), cp("т"))!.n, 2);
  equal(BigramStats.fromJSON("garbage").size, 0);
});

test("corne geometry priors", () => {
  const corne = loadKeyboard(Layout.RU_RU, Geometry.EYELASH_CORNE);
  const d = (a: string, b: string) => geometryDifficulty(corne, cp(a), cp(b));
  equal(d("к", "м"), 1); // Same finger, top to bottom row.
  equal(d("к", "е"), 0.7); // Same finger, same row.
  equal(d("о", "е"), 0); // Different hands.
  equal(d("о", "т"), 0.7); // Right index, home to bottom row.
  equal(d("а", "в"), 0); // Neighbours on the home row.
  equal(d("у", "м"), 0.5); // Full scissor, middle top to index bottom.
});

test("measured data overrides the prior", () => {
  const prior = bigramNeed(null, 1, 0.5, 300);
  equal(prior, 0.8);
  const fast = bigramNeed({ n: 100, t: 200, e: 0 }, 1, 0.5, 300);
  isTrue(fast < 0.1);
  const slow = bigramNeed({ n: 100, t: 600, e: 0.2 }, 0, 0, 300);
  isTrue(slow > 1);
});

test("weak bigrams drive word choice", () => {
  const corne = loadKeyboard(Layout.RU_RU, Geometry.EYELASH_CORNE);
  const { model } = loadModelSync(Language.RU);
  const lesson = new GuidedLesson(new Settings(), corne, model, []);
  const lessonKeys = lesson.update(makeKeyStatsMap(lesson.letters, []));
  const before = lesson.weakBigrams(lessonKeys, 100);
  isTrue(before.length > 0);
  const saved = bigramStore.current;
  try {
    const stats = new BigramStats();
    const steps = [];
    for (let i = 0; i < 50; i++) {
      steps.push({ codePoint: cp("н"), timeToType: 250, typo: false });
      steps.push({ codePoint: cp("а"), timeToType: 1500, typo: false });
    }
    stats.addSteps(steps, isLetter);
    bigramStore.current = stats;
    const after = lesson.weakBigrams(lessonKeys, 3);
    equal(after[0][0], "на");
  } finally {
    bigramStore.current = saved;
  }
});
