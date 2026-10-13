import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { Geometry, Language, Layout, loadKeyboard } from "@keybr/keyboard";
import { loadModelSync } from "@keybr/phonetic-model/lib/fs-load.ts";
import { LCG } from "@keybr/rand";
import { makeKeyStatsMap } from "@keybr/result";
import { Settings } from "@keybr/settings";
import { deepEqual, equal, isTrue } from "rich-assert";
import { geometryDifficulty } from "./bigrams.ts";
import { GuidedLesson } from "./guided.ts";
import { SymbolsLesson } from "./symbols.ts";

const words = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "../../keybr-content-words/lib/data/words-en.json",
    ),
    "utf8",
  ),
);
const corne = loadKeyboard(Layout.EN_US, Geometry.EYELASH_CORNE);
const { model } = loadModelSync(Language.EN);
const cp = (s: string) => s.codePointAt(0)!;

test("english guided lessons on a corne", () => {
  const lesson = new GuidedLesson(new Settings(), corne, model, words);
  // All 26 letters are on the base layer, nothing is skipped.
  equal(lesson.update(makeKeyStatsMap(lesson.letters, [])).letters.length, 26);
  const lessonKeys = lesson.update(makeKeyStatsMap(lesson.letters, []));
  const included = new Set(
    lessonKeys
      .findIncludedKeys()
      .map(({ letter }) => letter.label.toLowerCase()),
  );
  const text = String(lesson.generate(lessonKeys, LCG(1)));
  isTrue(text.length > 50);
  // Real english words made only of the unlocked letters.
  for (const word of text.split(" ")) {
    isTrue([...word].every((c) => included.has(c)));
  }
  isTrue(lesson.weakBigrams(lessonKeys, 5).length > 0);
});

test("english bigram priors on a corne", () => {
  const d = (a: string, b: string) => geometryDifficulty(corne, cp(a), cp(b));
  equal(d("e", "d"), 0.7); // Same finger, top to home.
  equal(d("r", "v"), 1); // Same finger, top to bottom.
  equal(d("a", "s"), 0); // Neighbours on the home row.
  equal(d("t", "h"), 0); // Different hands.
});

test("english symbols lesson on a corne", () => {
  const lesson = new SymbolsLesson(new Settings(), corne, model, words);
  const labels = lesson.letters.map(({ label }) => label).join("");
  for (const c of "1!@#$%^&*()-_=+[]{};:'\",.<>/?\\|`~") {
    isTrue(labels.includes(c), `missing ${c}`);
  }
  const text = String(
    lesson.generate(lesson.update(makeKeyStatsMap(lesson.letters, [])), LCG(3)),
  );
  isTrue(/[a-z]/.test(text) && /[^a-z ]/.test(text));
  // Every character of the text can be typed on this keyboard.
  for (const c of text.replaceAll(" ", "")) {
    isTrue(corne.getCombo(cp(c)) != null, `cannot type ${c}`);
  }
});

test("english layer keys on a corne", () => {
  // Digits and "-" live on the NUM layer, "[" on the base layer.
  equal(corne.getShape("Digit1")!.layer, "NUM");
  equal(corne.getShape("Minus")!.layer, "NUM");
  equal(corne.getShape("BracketLeft")!.layer, null);
  deepEqual(
    [corne.getCombo(cp("!"))!.id, corne.getCombo(cp("!"))!.modifier.shift],
    ["Digit1", true],
  );
});
