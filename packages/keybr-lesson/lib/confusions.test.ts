import { test } from "node:test";
import { Geometry, Language, Layout, loadKeyboard } from "@keybr/keyboard";
import { loadModelSync } from "@keybr/phonetic-model/lib/fs-load.ts";
import { LCG } from "@keybr/rand";
import { makeKeyStatsMap } from "@keybr/result";
import { Settings } from "@keybr/settings";
import { deepEqual, equal, isTrue } from "rich-assert";
import { ConfusionStats, confusionStore } from "./confusions.ts";
import { GuidedLesson } from "./guided.ts";

const cp = (s: string) => s.codePointAt(0)!;
const isLetter = (c: number) =>
  String.fromCodePoint(c).toLowerCase() !==
  String.fromCodePoint(c).toUpperCase();

test("count and age confusions", () => {
  const stats = new ConfusionStats();
  stats.add(
    [
      { expected: cp("с"), actual: cp("ч") },
      { expected: cp("с"), actual: cp("ч") },
      { expected: cp("и"), actual: cp("т") },
      { expected: cp("и"), actual: cp(" ") }, // Not a letter.
    ],
    isLetter,
  );
  equal(stats.size, 2);
  equal(stats.count(cp("с"), cp("ч")), 2);
  stats.add([], isLetter);
  equal(stats.count(cp("с"), cp("ч")), 2 * 0.97);
  deepEqual(
    stats.top(1).map(({ expected, actual }) => [expected, actual]),
    [[cp("с"), cp("ч")]],
  );
  const copy = ConfusionStats.fromJSON(JSON.parse(JSON.stringify(stats)));
  equal(copy.size, 2);
  equal(ConfusionStats.fromJSON([1, 2]).size, 0);
});

test("confusions drive word choice", () => {
  const corne = loadKeyboard(Layout.RU_RU, Geometry.EYELASH_CORNE);
  const { model } = loadModelSync(Language.RU);
  const words = ["сон", "час", "чета", "сто", "тесно", "нос", "оса", "сено"];
  const lesson = new GuidedLesson(new Settings(), corne, model, [
    ...words,
    ...["ота", "тон", "нет", "тот", "она", "оно", "тенета", "енот", "нота"],
    ...["ант", "атт", "тетна", "наот", "ноте", "етон"],
  ]);
  const lessonKeys = lesson.update(makeKeyStatsMap(lesson.letters, []));
  const saved = confusionStore.current;
  try {
    const stats = new ConfusionStats();
    for (let i = 0; i < 5; i++) {
      stats.add([{ expected: cp("и"), actual: cp("т") }], isLetter);
    }
    confusionStore.current = stats;
    deepEqual(lesson.weakConfusions(lessonKeys), [["и", "т"]]);
    // Not trained yet: "и" is a current letter, "ш" is not.
    stats.add([{ expected: cp("ш"), actual: cp("щ") }], isLetter);
    equal(lesson.weakConfusions(lessonKeys).length, 1);
    isTrue(String(lesson.generate(lessonKeys, LCG(1))).length > 0);
  } finally {
    confusionStore.current = saved;
  }
});
