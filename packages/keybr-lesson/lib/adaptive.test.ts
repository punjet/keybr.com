import { describe, test } from "node:test";
import { Geometry, Language, Layout, loadKeyboard } from "@keybr/keyboard";
import { FakePhoneticModel, type Letter } from "@keybr/phonetic-model";
import { loadModelSync } from "@keybr/phonetic-model/lib/fs-load.ts";
import { LCG } from "@keybr/rand";
import {
  type KeySample,
  type KeyStats,
  type KeyStatsMap,
  makeKeyStatsMap,
  speedToTime,
} from "@keybr/result";
import { Settings } from "@keybr/settings";
import { equal, isTrue } from "rich-assert";
import { accuracyFactor, errorRateOf } from "./adaptive.ts";
import { printLessonKeys } from "./fakes.ts";
import { GuidedLesson } from "./guided.ts";
import { lessonProps } from "./settings.ts";
import { SymbolsLesson } from "./symbols.ts";
import { Target } from "./target.ts";

const {
  letter1: A,
  letter2: B,
  letter3: C,
  letter4: D,
  letter5: E,
  letter6: F,
  letter7: G,
  letter8: H,
  letter9: I,
  letter10: J,
} = FakePhoneticModel;

const settings = new Settings();
const keyboard = loadKeyboard(Layout.EN_US);
const model = new FakePhoneticModel();

/** Key stats with `lessons` samples at the given confidence and error rate. */
function stats(
  items: [
    letter: Letter,
    confidence: number | null,
    bestConfidence?: number | null,
    errorRate?: number,
    lessons?: number,
  ][],
): KeyStatsMap {
  const target = new Target(settings);
  const time = (c: number | null | undefined) =>
    c == null ? null : speedToTime(target.targetSpeed) / c;
  const map = new Map<Letter, KeyStats>(
    items.map(([letter, c, best = c, errorRate = 0, lessons = 10]) => {
      const samples: KeySample[] = [];
      if (c != null) {
        for (let index = 0; index < lessons; index++) {
          samples.push({
            index,
            timeStamp: index * 60000,
            hitCount: Math.round(100 * (1 - errorRate)),
            missCount: Math.round(100 * errorRate),
            timeToType: time(c)!,
            filteredTimeToType: time(c)!,
          });
        }
      }
      return [
        letter,
        {
          letter,
          samples,
          timeToType: time(c),
          bestTimeToType: time(best),
        } as KeyStats,
      ];
    }),
  );
  return {
    letters: [...map.keys()],
    results: [],
    get: (letter) => map.get(letter),
    [Symbol.iterator]: () => map.values(),
  } as KeyStatsMap;
}

describe("accuracy", () => {
  test("error rate", () => {
    equal(errorRateOf([]), null);
    equal(
      errorRateOf([
        {
          index: 0,
          timeStamp: 0,
          hitCount: 90,
          missCount: 10,
          timeToType: 100,
          filteredTimeToType: 100,
        },
      ]),
      0.1,
    );
  });

  test("accuracy factor", () => {
    equal(accuracyFactor(null), 1);
    equal(accuracyFactor(0.01), 1);
    equal(accuracyFactor(0.13), 0.8);
    equal(accuracyFactor(0.9), 0.4);
  });
});

describe("focus", () => {
  const lesson = new GuidedLesson(settings, keyboard, model, []);

  test("a regressed key is trained again", () => {
    // The original algorithm ignores C because it once was above target.
    equal(
      printLessonKeys(
        lesson.update(
          stats([
            [A, 1.5],
            [B, 1.5],
            [C, 0.8, 1.2],
            [D, 1.5],
            [E, 1.5],
            [F, 1.5],
            [G, 0.95],
            [H, null],
            [I, null],
            [J, null],
          ]),
        ),
      ),
      "AB[C]DEFG",
    );
  });

  test("errors make a fast key weak", () => {
    equal(
      printLessonKeys(
        lesson.update(
          stats([
            [A, 1.2],
            [B, 1.2, 1.2, 0.25],
            [C, 0.95],
            [D, 1.5],
            [E, 1.5],
            [F, 1.5],
            [G, null],
            [H, null],
            [I, null],
            [J, null],
          ]),
        ),
      ),
      "A[B]CDEF",
    );
  });

  test("frequent letters win over rare ones", () => {
    equal(
      printLessonKeys(
        lesson.update(
          stats([
            [A, 0.8],
            [B, 1.5],
            [C, 1.5],
            [D, 1.5],
            [E, 1.5],
            [F, 0.75],
            [G, null],
            [H, null],
            [I, null],
            [J, null],
          ]),
        ),
      ),
      "[A]BCDEF",
    );
  });
});

describe("stall breaker", () => {
  const keys = (lessons: number) =>
    stats([
      [A, 1.1],
      [B, 1.1],
      [C, 1.1],
      [D, 1.1],
      [E, 1.1],
      [F, 1.1],
      [G, 0.9, 0.98, 0, lessons],
      [H, null],
      [I, null],
      [J, null],
    ]);

  test("waits while the newest key is fresh", () => {
    const lesson = new GuidedLesson(settings, keyboard, model, []);
    equal(printLessonKeys(lesson.update(keys(10))), "ABCDEF[G]");
  });

  test("unlocks one next key after a stall", () => {
    const lesson = new GuidedLesson(settings, keyboard, model, []);
    equal(printLessonKeys(lesson.update(keys(30))), "ABCDEFG[H]");
  });

  test("can be disabled", () => {
    const lesson = new GuidedLesson(
      settings.set(lessonProps.guided.stallLessons, 0),
      keyboard,
      model,
      [],
    );
    equal(printLessonKeys(lesson.update(keys(100))), "ABCDEF[G]");
  });
});

test("adaptive words come from the dictionary", () => {
  const words = ["abc", "bad", "cab", "dab", "fed", "bead", "face", "deaf"];
  const lesson = new GuidedLesson(
    settings.set(lessonProps.guided.naturalWords, true),
    keyboard,
    model,
    [...words, ...words.map((w) => `${w}e`), ...words.map((w) => `${w}a`)],
  );
  const lessonKeys = lesson.update(
    stats([
      [A, 1.2],
      [B, 0.5],
      [C, 1.2],
      [D, 1.2],
      [E, 1.2],
      [F, 1.2],
      [G, null],
      [H, null],
      [I, null],
      [J, null],
    ]),
  );
  const text = String(lesson.generate(lessonKeys, LCG(1)));
  isTrue(text.split(" ").every((w) => /^[abcdef]+$/.test(w)));
  isTrue(text.includes("b"));
});

test("symbols lesson mixes layer symbols with words", () => {
  const corne = loadKeyboard(Layout.RU_RU, Geometry.EYELASH_CORNE);
  const lesson = new SymbolsLesson(settings, corne, model, ["дом", "кот"]);
  const labels = lesson.letters.map(({ label }) => label).join("");
  isTrue(labels.includes("1") && labels.includes("№") && labels.includes(","));
  equal(labels.includes("₽"), false);
  const text = String(
    lesson.generate(lesson.update(makeKeyStatsMap(lesson.letters, [])), LCG(1)),
  );
  isTrue(/[дк]/.test(text));
  isTrue(/[^а-я ]/.test(text));
});

test("corne skips letters on the layer", () => {
  const corne = loadKeyboard(Layout.RU_RU, Geometry.EYELASH_CORNE);
  const { model: ru } = loadModelSync(Language.RU);
  const labels = (lesson: GuidedLesson) =>
    lesson
      .update(makeKeyStatsMap(lesson.letters, []))
      .letters.map(({ label }) => label)
      .join("");
  const skip = labels(new GuidedLesson(settings, corne, ru, []));
  equal(skip.includes("Ё") || skip.includes("Ъ"), false);
  equal(skip.length, 31);
  const keep = labels(
    new GuidedLesson(
      settings.set(lessonProps.guided.skipLayerLetters, false),
      corne,
      ru,
      [],
    ),
  );
  equal(keep.length, skip.length + 1);
});

describe("auto target", () => {
  const all = (best: number) =>
    stats([
      [A, 1, best],
      [B, 1, best],
      [C, 1, best],
      [D, 1, best],
      [E, 1, best],
      [F, 1, best],
      [G, 1, best],
      [H, 1, best],
      [I, 1, best],
      [J, 1, best],
    ]);

  test("grows once the whole alphabet is open", () => {
    const lesson = new GuidedLesson(settings, keyboard, model, []);
    lesson.update(all(1.5));
    // 175 * 1.5 * 1.05 rounded to 5.
    equal(lesson.targetSpeed, 275);
  });

  test("never drops below the configured target", () => {
    const lesson = new GuidedLesson(settings, keyboard, model, []);
    // 175 * 0.9 * 1.05 is below the configured target.
    lesson.update(all(0.9));
    equal(lesson.targetSpeed, 175);
  });

  test("can be disabled", () => {
    const lesson = new GuidedLesson(
      settings.set(lessonProps.guided.autoTarget, false),
      keyboard,
      model,
      [],
    );
    lesson.update(all(1.5));
    equal(lesson.targetSpeed, 175);
  });
});
